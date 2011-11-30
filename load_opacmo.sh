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

	psql -c "CREATE TABLE yoctogi (pmcid VARCHAR(24), entrezname__partition VARCHAR(1), entrezname VARCHAR(512), entrezid VARCHAR(24), entrezscore INTEGER, speciesname VARCHAR(512), speciesid VARCHAR(24), speciesscore INTEGER, oboname VARCHAR(512), oboid VARCHAR(24), oboscore INTEGER)" yoctogi
	for prefix in {a,b,c,d,e,f,g,h,i,j,k,l,m,n,o,p,q,r,s,t,u,v,w,x,y,z,0,1,2,3,4,5,6,7,8,9} ; do
		prefix_uppercase=`echo -n $prefix | tr a-z A-Z`
		if [[ "$prefix" = "$prefix_uppercase" ]] ; then
			psql -c "CREATE TABLE yoctogi__$prefix (CHECK (entrezname__partition = '$prefix')) INHERITS (yoctogi)" yoctogi
		else
			psql -c "CREATE TABLE yoctogi__$prefix (CHECK (entrezname__partition = '$prefix' OR entrezname__partition = '$prefix_uppercase')) INHERITS (yoctogi)" yoctogi
		fi
	done

	psql -c "CREATE TABLE yoctogi_titles (pmcid VARCHAR(24), pmctitle TEXT)" yoctogi
fi

for tsv in opacmo_data/*__yoctogi*.tsv ; do
	if [ ! -f "$tsv" ] ; then continue ; fi

	table_file=$tsv.tmp
	table=`basename "$tsv" .tsv | grep -o -E 'yoctogi(_.+)?$'`

	# If we see the main table, then make sure that all scores are integers.
	# Also: there needs to be a small fix for dealing with non-PMCIDs such
	# as 'BMC_Bioinformatics-6-Suppl' that can withstand previous filter runs.
	if [[ "$table" = 'yoctogi' ]] ; then
		awk -F "\t" '{
				entrezscore=$4;
				speciesscore=$7;
				oboscore=$10;
				if (entrezscore == "") { entrezscore='0' };
				if (speciesscore == "") { speciesscore='0' };
				if (oboscore == "") { oboscore='0' };
				print "PMC"$1"\t"substr($2, 1, 1)"\t"$2"\t"$3"\t"entrezscore"\t"$5"\t"$6"\t"speciesscore"\t"$8"\t"$9"\t"oboscore;
			}' $tsv | grep -E '^PMC[0-9]+	' > $table_file
	else
		awk -F "\t" '{print "PMC"$0}' $tsv > $table_file
	fi

	echo " - processing `basename "$tsv"`"

	if [[ "$db" = 'psql' ]] ; then
		for prefix in {a,b,c,d,e,f,g,h,i,j,k,l,m,n,o,p,q,r,s,t,u,v,w,x,y,z,0,1,2,3,4,5,6,7,8,9} ; do
			prefix_uppercase=`echo -n "$prefix" | tr a-z A-Z`
			<$table_file grep -E "^[^	]+	($prefix|$prefix_uppercase)" > `pwd`/${table_file}__$prefix
			psql -c "COPY $table FROM '`pwd`/${table_file}__$prefix'" yoctogi
		done
	fi

	if [[ "$db" = 'mongo' ]] ; then
		if [[ "$table" = 'yoctogi' ]] ; then
			mongoimport --type tsv -d yoctogi -c "$table" -f pmcid,entrezname,entrezid,entrezscore,speciesname,speciesid,speciesscore,oboname,oboid,oboscore,entrezname_lowercase,oboname_lowercase `pwd`/$table_file
		else
			mongoimport --type tsv -d yoctogi -c "$table" -f pmcid,pmctitle `pwd`/$table_file
		fi
	fi
done

rm -f opacmo_data/*tsv.tmp

if [[ "$db" = 'psql' ]] ; then
	for prefix in {a,b,c,d,e,f,g,h,i,j,k,l,m,n,o,p,q,r,s,t,u,v,w,x,y,z,0,1,2,3,4,5,6,7,8,9} ; do
		psql -c "CREATE INDEX pmcid__${prefix}_idx ON yoctogi__$prefix (pmcid)" yoctogi
		psql -c "CREATE INDEX pmcid_lower__${prefix}_idx ON yoctogi__$prefix ((lower(pmcid)))" yoctogi
		psql -c "CREATE INDEX entrezname__partition__${prefix}_idx ON yoctogi__$prefix (entrezname)" yoctogi
		psql -c "CREATE INDEX entrezname__${prefix}_idx ON yoctogi__$prefix (entrezname)" yoctogi
		psql -c "CREATE INDEX entrezname_lower__${prefix}_idx ON yoctogi__$prefix ((lower(entrezname)))" yoctogi
		psql -c "CREATE INDEX entrezid__${prefix}_idx ON yoctogi__$prefix (entrezid)" yoctogi
		psql -c "CREATE INDEX entrezid_lower__${prefix}_idx ON yoctogi__$prefix ((lower(entrezid)))" yoctogi
		psql -c "CREATE INDEX speciesname__${prefix}_idx ON yoctogi__$prefix (speciesname)" yoctogi
		psql -c "CREATE INDEX speciesname_lower__${prefix}_idx ON yoctogi__$prefix ((lower(speciesname)))" yoctogi
		psql -c "CREATE INDEX speciesid___${prefix}idx ON yoctogi__$prefix (speciesid)" yoctogi
		psql -c "CREATE INDEX speciesid_lower__${prefix}_idx ON yoctogi__$prefix ((lower(speciesid)))" yoctogi
		psql -c "CREATE INDEX oboname__${prefix}_idx ON yoctogi__$prefix (oboname)" yoctogi
		psql -c "CREATE INDEX oboname_lower__${prefix}_idx ON yoctogi__$prefix ((lower(oboname)))" yoctogi
		psql -c "CREATE INDEX oboid__${prefix}_idx ON yoctogi__$prefix (oboid)" yoctogi
		psql -c "CREATE INDEX oboid_lower__${prefix}_idx ON yoctogi__$prefix ((lower(oboid)))" yoctogi
	done

	psql -c "CREATE INDEX titles_pmcid_idx ON yoctogi_titles (pmcid)" yoctogi
fi

if [[ "$db" = 'psql' ]] ; then
	psql -c 'GRANT SELECT ON yoctogi TO yoctogi' yoctogi
	psql -c 'GRANT SELECT ON yoctogi_titles TO yoctogi' yoctogi
	for prefix in {a,b,c,d,e,f,g,h,i,j,k,l,m,n,o,p,q,r,s,t,u,v,w,x,y,z,0,1,2,3,4,5,6,7,8,9} ; do
		psql -c "GRANT SELECT ON yoctogi__$prefix TO yoctogi" yoctogi
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

