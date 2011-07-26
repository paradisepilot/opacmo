#!/bin/bash

db='psql'

if [[ "$db" = 'psql' ]] ; then
	tables_in_yoctogi=`psql -c '\dp' yoctogi | tail -n 2 | tr -d '\n' | grep -o -E '[0-9]+'`

	if [[ $tables_in_yoctogi -gt 0 ]] ; then
		echo "There are already tables in the 'yoctogi' database."
		echo ""
		echo "Make sure you know what you are doing and remove this"
		echo "test from the script. Don't come crying afterwards though."
		exit
	fi

	psql -c "CREATE TABLE yoctogi (pmcid VARCHAR(24), entrezname VARCHAR(512), entrezid VARCHAR(24), entrezscore INTEGER, speciesname VARCHAR(512), speciesid VARCHAR(24), speciesscore INTEGER, oboname VARCHAR(512), oboid VARCHAR(24), oboscore INTEGER)" yoctogi
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
				print "PMC"$1"\t"$2"\t"$3"\t"entrezscore"\t"$5"\t"$6"\t"speciesscore"\t"$8"\t"$9"\t"oboscore;
			}' $tsv | grep -E '^PMC[0-9]+	' > $table_file
	else
		awk -F "\t" '{print "PMC"$0}' $tsv > $table_file
	fi

	echo " - processing `basename "$tsv"`"

	if [[ "$db" = 'psql' ]] ; then
		psql -c "COPY $table FROM '`pwd`/$table_file'" yoctogi
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
	psql -c "CREATE INDEX pmcid_idx ON yoctogi (pmcid)" yoctogi
	psql -c "CREATE INDEX pmcid_lower_idx ON yoctogi ((lower(pmcid)))" yoctogi
	psql -c "CREATE INDEX entrezname_idx ON yoctogi (entrezname)" yoctogi
	psql -c "CREATE INDEX entrezname_lower_idx ON yoctogi ((lower(entrezname)))" yoctogi
	psql -c "CREATE INDEX entrezid_idx ON yoctogi (entrezid)" yoctogi
	psql -c "CREATE INDEX entrezid_lower_idx ON yoctogi ((lower(entrezid)))" yoctogi
	psql -c "CREATE INDEX speciesname_idx ON yoctogi (speciesname)" yoctogi
	psql -c "CREATE INDEX speciesname_lower_idx ON yoctogi ((lower(speciesname)))" yoctogi
	psql -c "CREATE INDEX speciesid_idx ON yoctogi (speciesid)" yoctogi
	psql -c "CREATE INDEX speciesid_lower_idx ON yoctogi ((lower(speciesid)))" yoctogi
	psql -c "CREATE INDEX oboname_idx ON yoctogi (oboname)" yoctogi
	psql -c "CREATE INDEX oboname_lower_idx ON yoctogi ((lower(oboname)))" yoctogi
	psql -c "CREATE INDEX oboid_idx ON yoctogi (oboid)" yoctogi
	psql -c "CREATE INDEX oboid_lower_idx ON yoctogi ((lower(oboid)))" yoctogi

	psql -c "CREATE INDEX titles_pmcid_idx ON yoctogi_titles (pmcid)" yoctogi
fi

if [[ "$db" = 'psql' ]] ; then
	echo "Almost done."
	echo ""
	echo "For security, you will have to grant permissions to the 'yoctogi' user manually."
	echo "Do the folling SQL commands manually:"
	echo "  GRANT SELECT ON yoctogi TO yoctogi;"
	echo "  GRANT SELECT ON yoctogi_titles TO yoctogi;"
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

