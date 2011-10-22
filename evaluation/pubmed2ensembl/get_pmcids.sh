#!/bin/bash

# This script compares opacmo's current release against pubmed2ensembl 56.
#
# The output is formatted as TSV and sent directly to stdout, where
# output from curl can be seen on stderr.
#
# Despite the output of many different metrics, not all of them can
# be interpreted directly. Precision and recall are skewed here, for
# example.
#
# How this works:
#   The script will cd into `data` and start downloading all
#   necessary files and query pubmed2ensembl56 as well as the
#   current version of opacmo.
#   Statistics are written to stdout, so it is best to redirect
#   the output into a .tsv-file for later processing in R or
#   whatnot.
#   Just before the script finishes, it does a `cd ..`, which
#   should bring it back to where it came from.

esearch_url=http://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi
pubmed2ensembl_url=http://pubmed2ensembl56.smith.man.ac.uk/biomart/martservice/result
opacmo_url=http://www.opacmo.org/yoctogi.fcgi

pubmed2ensembl_date='2009/02/05'
opacmo_date='2011/08/15'

scale=3

tmp_file=/tmp/evaluation.tmp

function esearch {
	eutils_file=$1
	pmc_file=$2

	curl --data @$eutils_file $esearch_url \
		| grep -o -E '<Id>[0-9]+</Id>' \
		| grep -o -E '[0-9]+' \
		| sort | uniq | sed 's/^/PMC/' > $pmc_file
}

function header {
	echo -e "Gene Symbol\tSpecies\tService\tOA Publications\tLinked Publications\tTrue Positives\tFalse Positives\tFalse Negatives\tPrecisions\tRecall\tF1 Score\tTrue Positive Rate\tFalse Discovery Rate"
}

function evaluation {
	service=$1
	gene=$2
	species=$3
	pmcid_oa_file=$4
	result_file=$5

	oa=`<$pmcid_oa_file wc -l | tr -d ' '`
	tpfp=`<$result_file wc -l | tr -d ' '`
	tp=`join $pmcid_oa_file $result_file | wc -l | grep -o -E '^\ *[0-9]+' | tr -d ' '`
	let fp=tpfp-tp

	# For the false negatives I need a temporary file for grep (well.. I don't, but
	# I want to get the number from the related set operations as a sanity check..)
	join $pmcid_oa_file $result_file > $tmp_file
	fn=`grep -v -f $tmp_file $pmcid_oa_file | wc -l | grep -o -E '^\ *[0-9]+' | tr -d ' '`
	rm $tmp_file

	if [ $tpfp -gt 0 ]  &&  [ $oa -gt 0 ] ; then
		precision=`echo "scale=$scale; $tp/$tpfp" | bc`
		recall=`echo "scale=$scale; $tp/$oa" | bc`
		pr=`echo "scale=$scale; $precision+$recall" | bc`
		if [ "$pr" != "0" ] ; then
			f1=`echo "scale=$scale; 2*$precision*$recall/($precision+$recall)" | bc`
		else
			f1=0
		fi
	else
		precision=0
		recall=0
		f1=0
	fi

	if [ $tp -gt 0 ] || [ $fn -gt 0 ] ; then
		tpr=`echo "scale=$scale; $tp/($tp+$fn)" | bc`
	else
		tpr=0
	fi

	if [ $tp -gt 0 ] || [ $fp -gt 0 ] ; then
		fdr=`echo "scale=$scale; $fp/($tp+$fp)" | bc`
	else
		fdr=0
	fi

	echo -e "$gene\t$species\t$service\t$oa\t$tpfp\t$tp\t$fp\t$fn\t$precision\t$recall\t$f1\t$tpr\t$fdr"
}

if [ ! -d "data" ] ; then
	mkdir data
fi

cd data

# Get list of open access articles:
curl -O ftp://ftp.ncbi.nlm.nih.gov/pub/pmc/file_list.txt

# Extract only the PubMed Central IDs from the list:
cut -s -f 3 file_list.txt | sort | uniq > pmc_oa.tsv

for maxdate in {$pubmed2ensembl_date,$opacmo_date} ; do
	for gene in {'BRCA2','Myc','APC','DCC'} ; do
		for species in {'humans','mice','drosophila+melanogaster','danio+rerio'} ; do
			maxdate_clean=`echo "$maxdate" | sed 's/\///g'`

			esearch_file=${maxdate_clean}_${gene}_$species.esearch
			pmcid_file=${maxdate_clean}_${gene}_${species}_all.tsv
			pmcid_oa_file=${maxdate_clean}_${gene}_${species}_oa.tsv

			if [ "$gene" == "Myc" ] && [ "$species" == "drosophila+melanogaster" ] ; then
				genename=dm
			elif [ "$gene" == "DCC" ] && [ "$species" == "drosophila+melanogaster" ] ; then
				genename=fra
			elif [ "$gene" == "Myc" ] && [ "$species" == "danio+rerio" ] ; then
				genename=myca
			else
				genename=$gene
			fi

			# Query for synonyms too:
			if [ "$genename" == "BRCA2" ] && [ "$species" == "humans" ] ; then
				# http://www.ncbi.nlm.nih.gov/gene/675 (2011/10/21)
				synonym_list='FAD;FACD;FAD1;GLM3;BRCC2;FANCB;FANCD;PNCA2;FANCD1;BROVCA2'
			elif [ "$genename" == "BRCA2" ] && [ "$species" == "mice" ] ; then
				# http://www.ncbi.nlm.nih.gov/gene/12190 (2011/10/21)
				synonym_list='Fancd1;RAB163;AI256696;AW045498'
			elif [ "$genename" == "BRCA2" ] && [ "$species" == "drosophila+melanogaster" ] ; then
				# http://www.ncbi.nlm.nih.gov/gene/37916 (2011/10/21)
				synonym_list='30169;BcDNA:SD25109;brca2;CG13583;CG13584;CG30169;dmbrca2;Dmel\\CG30169'
			elif [ "$genename" == "BRCA2" ] && [ "$species" == "danio+rerio" ] ; then
				# http://www.ncbi.nlm.nih.gov/gene/566758 (2011/10/21)
				synonym_list='fancd1'
			elif [ "$genename" == "Myc" ] && [ "$species" == "humans" ] ; then
				# http://www.ncbi.nlm.nih.gov/gene/4609 (2011/10/21)
				synonym_list='MRTL;c-Myc;bHLHe39'
			elif [ "$genename" == "Myc" ] && [ "$species" == "mice" ] ; then
				# http://www.ncbi.nlm.nih.gov/gene/17869 (2011/10/21)
				synonym_list='Myc2;Nird;Niard;bHLHe39;AU016757'
			elif [ "$genename" == "dm" ] ; then
				# http://www.ncbi.nlm.nih.gov/gene/31310 (2011/10/21)
				synonym_list='anon-WO03040301\.171;bHLHe57;c-myc;c-Myc;c-MYC;CG10798;d-myc;D-Myc;Dm;dm/dMyc;dm/myc;Dmel\\CG10798;dmyc;dMyc;dMYC;Dmyc;DMYc;dmyc1;dMyc1;EG:BACN5I9\.1;l\(1\)G0139;myc;Myc;MYC'
			elif [ "$genename" == "myca" ] ; then
				# http://www.ncbi.nlm.nih.gov/gene/30686 (2011/10/21)
				synonym_list='MYC;cmyc;c-myc;zc-myc'
			elif [ "$genename" == "APC" ] && [ "$species" == "humans" ] ; then
				# http://www.ncbi.nlm.nih.gov/gene/324 (2011/10/21)
				synonym_list='GS;DP2;DP3;BTPS2;DP2\.5'
			elif [ "$genename" == "APC" ] && [ "$species" == "mice" ] ; then
				# http://www.ncbi.nlm.nih.gov/gene/11789 (2011/10/21)
				synonym_list='CC1;Min;mAPC;AI047805;AU020952;AW124434'
			elif [ "$genename" == "APC" ] && [ "$species" == "drosophila+melanogaster" ] ; then
				# http://www.ncbi.nlm.nih.gov/gene/44642 (2011/10/21)
				synonym_list='apc;APC;apc1;Apc1;APC1;CG1451;d-APC;D-APC;D-APC1;dApc;dAPC;DAPC;dAPC1;Dmel\\CG1451'
			elif [ "$genename" == "APC" ] && [ "$species" == "danio+rerio" ] ; then
				# http://www.ncbi.nlm.nih.gov/gene/386762 (2011/10/21)
				synonym_list='cb965;im:7150932;im:7152872'
			elif [ "$genename" == "DCC" ] && [ "$species" == "humans" ] ; then
				# http://www.ncbi.nlm.nih.gov/gene/1630 (2011/10/21)
				synonym_list='CRC18;CRCR1;IGDCC1'
			elif [ "$genename" == "DCC" ] && [ "$species" == "mice" ] ; then
				# http://www.ncbi.nlm.nih.gov/gene/13176 (2011/10/21)
				synonym_list='Igdcc1;C030036D22Rik'
			elif [ "$genename" == "fra" ] ; then
				# http://www.ncbi.nlm.nih.gov/gene/36377 (2011/10/21)
				synonym_list='CG8581;CT24981;DCC;Dmel\\CG8581;Fra'
			elif [ "$genename" == "DCC" ] && [ "$species" == "danio+rerio" ] ; then
				# http://www.ncbi.nlm.nih.gov/gene/569360 (2011/10/21)
				synonym_list='zdcc'
			fi

			synonyms=`echo "$synonym_list" | sed 's/;/[Body+-+All+Words]+OR+/g'`

			sed "s#_MAXDATE_#$maxdate#" ../TEMPLATE.esearch \
				| sed "s/_GENENAME_/$genename/g" \
				| sed "s/_SPECIESNAME_/$species/g" \
				| sed "s/_SYNONYMS_/$synonyms/" > $esearch_file

			# Retrieve document IDs from PubMed Central -- limited by the
			# respective date for which the text mining run was carried out!
			# This will retrieve all PubMed Central documents, some of which
			# might not be part of the open access subset.
			esearch $esearch_file $pmcid_file

			# Restrict the retrieved IDs from PubMed Central to its OA subset:
			join pmc_oa.tsv $pmcid_file > $pmcid_oa_file
		done
	done
done

for gene in {'BRCA2','Myc','APC','DCC'} ; do
	for species in {'humans','mice','drosophila+melanogaster','danio+rerio'} ; do
		# pubmed2ensembl uses BioMart as data backend:
		biomart_query_file=${gene}_$species.biomart
		biomart_result_file=${gene}_${species}_pubmed2ensembl.tsv

		# opacmo uses Yoctogi as data backend:
		yoctogi_query_file=${gene}_$species.yoctogi
		yoctogi_result_file=${gene}_${species}_opacmo.tsv

		# pubmed2ensembl contains datasets on a per species basis, which
		# are referred to by their latin name. It is possible to select
		# a gene by symbol (since the species is already determined by the
		# dataset), but each dataset has its own filter name (depending
		# on the specialised gene database of the species).
		if [ "$species" == "humans" ] ; then
			latinname=hsapiens
			filtername=hgnc_symbol
			genename=$gene
		elif [ "$species" == "mice" ] ; then
			latinname=mmusculus
			filtername=mgi_symbol
			genename=$gene
		elif [ "$species" == "drosophila+melanogaster" ] ; then
			latinname=dmelanogaster
			filtername=flybasename_gene
			if [ "$gene" == "Myc" ] ; then
				genename=dm
			elif [ "$gene" == "DCC" ] ; then
				genename=fra
			else
				genename=$gene
			fi
		elif [ "$species" == "danio+rerio" ] ; then
			latinname=drerio
			filtername=entrezgene
			if [ "$gene" == "BRCA2" ] ; then
				# brca2
				genename=566758
			elif [ "$gene" == "Myc" ] ; then
				# myca
				genename=30686
			elif [ "$gene" == "APC" ] ; then
				# apc
				genename=386762
			elif [ "$gene" == "DCC" ] ; then
				# dcc
				genename=569360
			fi
		fi

		sed "s/_GENENAME_/$genename/" ../TEMPLATE.biomart \
			| sed "s/_SPECIESNAME_/$latinname/" \
			| sed "s/_FILTERNAME_/$filtername/" > $biomart_query_file

		curl -d @$biomart_query_file $pubmed2ensembl_url \
			| sort | uniq > $biomart_result_file

		# opacmo does not partition its data, so we have to be a bit more
		# specific here. For example, 'BRCA2' could match against the genes of
		# many at the same time. The query is therefore carried out over
		# the Entrez gene ID instead.
		if [ "$gene" == "BRCA2" ] ; then
			if [ "$species" == "humans" ] ; then
				geneid=675
			elif [ "$species" == "mice" ] ; then
				geneid=12190
			elif [ "$species" == "drosophila+melanogaster" ] ; then
				geneid=37916
			elif [ "$species" == "danio+rerio" ] ; then
				geneid=566758
			fi
		elif [ "$gene" == "Myc" ] ; then
			if [ "$species" == "humans" ] ; then
				geneid=4609
			elif [ "$species" == "mice" ] ; then
				geneid=17869
			elif [ "$species" == "drosophila+melanogaster" ] ; then
				geneid=31310
			elif [ "$species" == "danio+rerio" ] ; then
				geneid=30686
			fi
		elif [ "$gene" == "APC" ] ; then
			if [ "$species" == "humans" ] ; then
				geneid=324
			elif [ "$species" == "mice" ] ; then
				geneid=11789
			elif [ "$species" == "drosophila+melanogaster" ] ; then
				geneid=44642
			elif [ "$species" == "danio+rerio" ] ; then
				geneid=386762
			fi
		elif [ "$gene" == "DCC" ] ; then
			if [ "$species" == "humans" ] ; then
				geneid=1630
			elif [ "$species" == "mice" ] ; then
				geneid=13176
			elif [ "$species" == "drosophila+melanogaster" ] ; then
				geneid=36377
			elif [ "$species" == "danio+rerio" ] ; then
				geneid=569360
			fi
		fi

		sed "s/_GENEID_/$geneid/" ../TEMPLATE.yoctogi \
			| sed "s/_SPECIESNAME_/$latinname/" \
			| sed "s/_FILTERNAME_/$filtername/" > $yoctogi_query_file

		curl --data @$yoctogi_query_file $opacmo_url \
			| grep -o -E 'PMC[0-9]+":' \
			| grep -o -E 'PMC[0-9]+' \
			| sort | uniq > $yoctogi_result_file
	done
done

header

for gene in {'BRCA2','Myc','APC','DCC'} ; do
	for species in {'humans','mice','drosophila+melanogaster','danio+rerio'} ; do
		pubmed2ensembl_clean_date=`echo "$pubmed2ensembl_date" | sed 's/\///g'`
		opacmo_clean_date=`echo "$opacmo_date" | sed 's/\///g'`

		pmcid_oa_pubmed2ensembl_file=${pubmed2ensembl_clean_date}_${gene}_${species}_oa.tsv
		pmcid_oa_opacmo_file=${opacmo_clean_date}_${gene}_${species}_oa.tsv

		biomart_result_file=${gene}_${species}_pubmed2ensembl.tsv
		yoctogi_result_file=${gene}_${species}_opacmo.tsv

		evaluation "pubmed2ensembl" $gene $species $pmcid_oa_pubmed2ensembl_file $biomart_result_file
		evaluation "opacmo" $gene $species $pmcid_oa_opacmo_file $yoctogi_result_file
	done
done

# Comin' home Ma'!
cd ..

