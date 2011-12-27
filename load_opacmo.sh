#!/bin/bash

db='psql'

touch opacmo_data/WRITE_TEST
if [[ $? -ne 0 ]] ; then
	echo "No write permissions to 'opacmo_data'. Please"
	echo "set the rights so that the 'postgres' user can"
	echo "read/write to the directory."
	exit 1
fi
rm -f opacmo_data/WRITE_TEST

if [[ "$db" = 'psql' ]] ; then
	database_check=`psql -c '\dt' yoctogi`

	if [[ $? -ne 0 ]] ; then
		psql -c "CREATE DATABASE yoctogi" postgres &> /dev/null

		if [[ $? -ne 0 ]] ; then
			echo "Could not create the 'yoctogi' database."
			echo "Do you have the right permissions? Are you sure"
			echo "you are running this script as the 'postgres' user?"
			exit 1
		fi
	fi

	tables_in_yoctogi=`psql -c '\dp' yoctogi | tail -n 2 | tr -d '\n' | grep -o -E '[0-9]+'`

	if [[ $tables_in_yoctogi -gt 0 ]] ; then
		echo "There are already tables in the 'yoctogi' database."
		echo ""
		echo "Make sure you know what you are doing and remove this"
		echo "test from the script. Don't come crying afterwards though."
		exit 1
	fi

	echo -n "Creating fact table: "
	psql -c "CREATE TABLE yoctogi (pmcid VARCHAR(24), prefix__partition VARCHAR(2), entrezname VARCHAR(512), entrezid VARCHAR(24), entrezscore INTEGER, speciesname VARCHAR(512), speciesid VARCHAR(24), speciesscore INTEGER, oboname VARCHAR(512), oboid VARCHAR(24), oboscore INTEGER)" yoctogi
	echo -n "Creating dimension tables:"
	for prefix_0 in {a,b,c,d,e,f,g,h,i,j,k,l,m,n,o,p,q,r,s,t,u,v,w,x,y,z,0,1,2,3,4,5,6,7,8,9} ; do
		for prefix_1 in {a,b,c,d,e,f,g,h,i,j,k,l,m,n,o,p,q,r,s,t,u,v,w,x,y,z,0,1,2,3,4,5,6,7,8,9} ; do
			echo -n "  prefix ${prefix_0}${prefix_1}: "
			psql -c "CREATE TABLE yoctogi__${prefix_0}${prefix_1} (CHECK (prefix__partition = '${prefix_0}${prefix_1}')) INHERITS (yoctogi)" yoctogi
		done
	done

	psql -c "CREATE TABLE yoctogi_titles (pmcid VARCHAR(24), pmctitle TEXT)" yoctogi
fi

for tsv in opacmo_data/*__yoctogi*.tsv ; do
	if [ ! -f "$tsv" ] ; then continue ; fi

	table_file=$tsv.tmp
	table=`basename "$tsv" .tsv | grep -o -E 'yoctogi(_.+)?$'`

	# If we see the main table, then make sure that all scores are integers.
	if [[ "$table" = 'yoctogi' ]] ; then
		awk -F "\t" '{
				entrezscore=$4;
				speciesscore=$7;
				oboscore=$10;
				if (entrezscore == "") { entrezscore='0' };
				if (speciesscore == "") { speciesscore='0' };
				if (oboscore == "") { oboscore='0' };
				entreznameprefix=tolower(substr($2, 1, 2));
				speciesnameprefix=tolower(substr($5, 1, 2));
				obonameprefix=tolower(substr($8, 1, 2));
				entrezidprefix=tolower(substr($3, 1, 2));
				speciesidprefix=tolower(substr($6, 1, 2));
				oboidprefix=tolower(substr($9, 1, 2));
				print "PMC"$1"\t"entreznameprefix"\t"$2"\t"$3"\t"entrezscore"\t"$5"\t"$6"\t"speciesscore"\t"$8"\t"$9"\t"oboscore;
				print "PMC"$1"\t"speciesnameprefix"\t"$2"\t"$3"\t"entrezscore"\t"$5"\t"$6"\t"speciesscore"\t"$8"\t"$9"\t"oboscore;
				print "PMC"$1"\t"obonameprefix"\t"$2"\t"$3"\t"entrezscore"\t"$5"\t"$6"\t"speciesscore"\t"$8"\t"$9"\t"oboscore;
				print "PMC"$1"\t"entrezidprefix"\t"$2"\t"$3"\t"entrezscore"\t"$5"\t"$6"\t"speciesscore"\t"$8"\t"$9"\t"oboscore;
				print "PMC"$1"\t"speciesidprefix"\t"$2"\t"$3"\t"entrezscore"\t"$5"\t"$6"\t"speciesscore"\t"$8"\t"$9"\t"oboscore;
				print "PMC"$1"\t"oboidprefix"\t"$2"\t"$3"\t"entrezscore"\t"$5"\t"$6"\t"speciesscore"\t"$8"\t"$9"\t"oboscore;
			}' $tsv | grep -E '^PMC[0-9]+	' | sort | uniq > $table_file
	else
		awk -F "\t" '{print "PMC"$0}' $tsv > $table_file
	fi

	echo " - processing `basename "$tsv"`"

	if [[ "$db" = 'psql' ]] ; then
		for prefix_0 in {a,b,c,d,e,f,g,h,i,j,k,l,m,n,o,p,q,r,s,t,u,v,w,x,y,z,0,1,2,3,4,5,6,7,8,9} ; do
			for prefix_1 in {a,b,c,d,e,f,g,h,i,j,k,l,m,n,o,p,q,r,s,t,u,v,w,x,y,z,0,1,2,3,4,5,6,7,8,9} ; do
				echo -n "   prefix ${prefix_0}${prefix_1}: "
				<$table_file grep -E "^[^	]+	${prefix_0}${prefix_1}	" > `pwd`/${table_file}__${prefix_0}${prefix_1}
				psql -c "COPY $table FROM '`pwd`/${table_file}__${prefix_0}${prefix_1}'" yoctogi
			done
		done
	fi

	if [[ "$db" = 'mongo' ]] ; then
		if [[ "$table" = 'yoctogi' ]] ; then
			mongoimport --type tsv -d yoctogi -c "$table" -f pmcid,entrezname,entrezid,entrezscore,speciesname,speciesid,speciesscore,oboname,oboid,oboscore,entrezname_lowercase,oboname_lowercase `pwd`/$table_file
		else
			mongoimport --type tsv -d yoctogi -c "$table" -f pmcid,pmctitle `pwd`/$table_file
		fi
	fi

	rm -f $tsv $table_file ${table_file}__*
done

if [[ "$db" = 'psql' ]] ; then
	for prefix_0 in {a,b,c,d,e,f,g,h,i,j,k,l,m,n,o,p,q,r,s,t,u,v,w,x,y,z,0,1,2,3,4,5,6,7,8,9} ; do
		for prefix_1 in {a,b,c,d,e,f,g,h,i,j,k,l,m,n,o,p,q,r,s,t,u,v,w,x,y,z,0,1,2,3,4,5,6,7,8,9} ; do
			psql -c "CREATE INDEX pmcid__${prefix_0}${prefix_1}_idx ON yoctogi__${prefix_0}${prefix_1} USING btree (pmcid) WITH (fillfactor=100)" yoctogi
			psql -c "CREATE INDEX pmcid_lower__${prefix_0}${prefix_1}_idx ON yoctogi__${prefix_0}${prefix_1} USING btree ((lower(pmcid))) WITH (fillfactor=100)" yoctogi
			psql -c "CREATE INDEX entrezname__partition__${prefix_0}${prefix_1}_idx ON yoctogi__${prefix_0}${prefix_1} USING btree (entrezname) WITH (fillfactor=100)" yoctogi
			psql -c "CREATE INDEX entrezname__${prefix_0}${prefix_1}_idx ON yoctogi__${prefix_0}${prefix_1} USING btree (entrezname) WITH (fillfactor=100)" yoctogi
			psql -c "CREATE INDEX entrezname_lower__${prefix_0}${prefix_1}_idx ON yoctogi__${prefix_0}${prefix_1} USING btree ((lower(entrezname))) WITH (fillfactor=100)" yoctogi
			psql -c "CREATE INDEX entrezid__${prefix_0}${prefix_1}_idx ON yoctogi__${prefix_0}${prefix_1} USING btree (entrezid) WITH (fillfactor=100)" yoctogi
			psql -c "CREATE INDEX entrezid_lower__${prefix_0}${prefix_1}_idx ON yoctogi__${prefix_0}${prefix_1} USING btree ((lower(entrezid))) WITH (fillfactor=100)" yoctogi
			psql -c "CREATE INDEX speciesname__${prefix_0}${prefix_1}_idx ON yoctogi__${prefix_0}${prefix_1} USING btree (speciesname) WITH (fillfactor=100)" yoctogi
			psql -c "CREATE INDEX speciesname_lower__${prefix_0}${prefix_1}_idx ON yoctogi__${prefix_0}${prefix_1} USING btree ((lower(speciesname))) WITH (fillfactor=100)" yoctogi
			psql -c "CREATE INDEX speciesid__${prefix_0}${prefix_1}_idx ON yoctogi__${prefix_0}${prefix_1} USING btree (speciesid) WITH (fillfactor=100)" yoctogi
			psql -c "CREATE INDEX speciesid_lower__${prefix_0}${prefix_1}_idx ON yoctogi__${prefix_0}${prefix_1} USING btree ((lower(speciesid))) WITH (fillfactor=100)" yoctogi
			psql -c "CREATE INDEX oboname__${prefix_0}${prefix_1}_idx ON yoctogi__${prefix_0}${prefix_1} USING btree (oboname) WITH (fillfactor=100)" yoctogi
			psql -c "CREATE INDEX oboname_lower__${prefix_0}${prefix_1}_idx ON yoctogi__${prefix_0}${prefix_1} USING btree ((lower(oboname))) WITH (fillfactor=100)" yoctogi
			psql -c "CREATE INDEX oboid__${prefix_0}${prefix_1}_idx ON yoctogi__${prefix_0}${prefix_1} USING btree (oboid) WITH (fillfactor=100)" yoctogi
			psql -c "CREATE INDEX oboid_lower__${prefix_0}${prefix_1}_idx ON yoctogi__${prefix_0}${prefix_1} USING btree ((lower(oboid))) WITH (fillfactor=100)" yoctogi

			psql -c "ANALYZE yoctogi__${prefix_0}${prefix_1}" yoctogi
		done
	done

	psql -c "ANALYZE yoctogi" yoctogi

	psql -c "CREATE INDEX titles_pmcid_idx ON yoctogi_titles (pmcid)" yoctogi
fi

if [[ "$db" = 'psql' ]] ; then
	psql -c 'GRANT SELECT ON yoctogi TO yoctogi' yoctogi
	psql -c 'GRANT SELECT ON yoctogi_titles TO yoctogi' yoctogi
	for prefix_0 in {a,b,c,d,e,f,g,h,i,j,k,l,m,n,o,p,q,r,s,t,u,v,w,x,y,z,0,1,2,3,4,5,6,7,8,9} ; do
		for prefix_1 in {a,b,c,d,e,f,g,h,i,j,k,l,m,n,o,p,q,r,s,t,u,v,w,x,y,z,0,1,2,3,4,5,6,7,8,9} ; do
			psql -c "GRANT SELECT ON yoctogi__${prefix_0}${prefix_1} TO yoctogi" yoctogi
		done
	done

	echo ""
	echo "SECURITY"
	echo "  Note that the user 'yoctogi' has SELECT permissions"
	echo "  on all Yoctogi tables."
fi

if [[ "$db" = 'mongo' ]] ; then
	echo -e "use yoctogi\ndb.yoctogi.ensureIndex({pmcid:1})" | mongo
	echo -e "use yoctogi\ndb.yoctogi.ensureIndex({entrezname:1})" | mongo
	echo -e "use yoctogi\ndb.yoctogi.ensureIndex({entrezid:1})" | mongo
	echo -e "use yoctogi\ndb.yoctogi.ensureIndex({speciesname:1})" | mongo
	echo -e "use yoctogi\ndb.yoctogi.ensureIndex({speciesid:1})" | mongo
	echo -e "use yoctogi\ndb.yoctogi.ensureIndex({oboname:1})" | mongo
	echo -e "use yoctogi\ndb.yoctogi.ensureIndex({oboid:1})" | mongo
	echo -e "use yoctogi\ndb.yoctogi.ensureIndex({entrezname_lowercase:1})" | mongo
	echo -e "use yoctogi\ndb.yoctogi.ensureIndex({oboname_lowercase:1})" | mongo
	echo -e "use yoctogi\ndb.yoctogi_titles.ensureIndex({pmcid:1})" | mongo
fi

