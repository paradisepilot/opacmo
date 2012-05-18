#!/bin/bash

# This script creates the statistics that are published about opacmo.
# The data is directly taken from the database, so it is 100% in sync
# with users' views.

db='psql'

fact_table=yoctogi

if [[ "$db" = 'psql' ]] ; then
	database_check=`psql -c '\dt' yoctogi`

	if [[ $? -ne 0 ]] ; then
		echo "There is no Yoctogi database present."
		exit 1
	fi

	echo -n "PubMed Central IDs:   "
	ids=`psql -t -c 'SELECT COUNT(DISTINCT pmcid) FROM yoctogi__p_pmcid__pm' yoctogi`
	echo $ids

	rm -f /tmp/pmc2entrez
	rm -f /tmp/pmc2species
	rm -f /tmp/pmc2ontology

	entrezids=0
	speciesids=0
	for prefix_0 in {1,2,3,4,5,6,7,8,9} ; do
		for prefix_1 in {1,2,3,4,5,6,7,8,9,0} ; do
			ids=`psql -t -c "SELECT COUNT(DISTINCT entrezid) FROM yoctogi__p_entrezid__${prefix_0}${prefix_1}" yoctogi`
			let entrezids=entrezids+ids

			ids=`psql -t -c "SELECT COUNT(DISTINCT speciesid) FROM yoctogi__p_speciesid__${prefix_0}${prefix_1}" yoctogi`
			let speciesids=speciesids+ids

			psql -t -c "SELECT DISTINCT pmcid FROM yoctogi__p_entrezid__${prefix_0}${prefix_1}" yoctogi >> /tmp/pmc2entrez
			psql -t -c "SELECT DISTINCT pmcid FROM yoctogi__p_speciesid__${prefix_0}${prefix_1}" yoctogi >> /tmp/pmc2species
		done
	done
	psql -t -c "SELECT DISTINCT pmcid FROM yoctogi__p_goid__go" yoctogi >> /tmp/pmc2ontology
	psql -t -c "SELECT DISTINCT pmcid FROM yoctogi__p_doid__do" yoctogi >> /tmp/pmc2ontology
	psql -t -c "SELECT DISTINCT pmcid FROM yoctogi__p_chebiid__ch" yoctogi >> /tmp/pmc2ontology
	withentrez=`sort /tmp/pmc2entrez | uniq | wc -l`
	withspecies=`sort /tmp/pmc2species | uniq | wc -l`
	withontology=`sort /tmp/pmc2ontology | uniq | wc -l`
	echo "  ...with genes:   $withentrez"
	echo "  ...with species: $withspecies"
	echo "  ...with terms:    $withontology"

	echo "Entrez Gene IDs:      $entrezids"
	echo "Species IDs:          $speciesids"

	totalontology=0
	echo -n "Gene Ontology IDs:    "
	ids=`psql -t -c 'SELECT COUNT(DISTINCT goid) FROM yoctogi__p_goid__go' yoctogi`
	echo $ids
	let totalontology=totalontology+ids

	echo -n "Disease Ontology IDs: "
	ids=`psql -t -c 'SELECT COUNT(DISTINCT doid) FROM yoctogi__p_doid__do' yoctogi`
	echo $ids
	let totalontology=totalontology+ids

	echo -n "ChEBI Ontology IDs:   "
	ids=`psql -t -c 'SELECT COUNT(DISTINCT chebiid) FROM yoctogi__p_chebiid__ch' yoctogi`
	echo $ids
	let totalontology=totalontology+ids

	echo "Total ontology IDs:   $totalontology"
fi
