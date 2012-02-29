#!/bin/bash

PATH=$PATH:./opacmo:./bioknack
IFS=$(echo -e -n "\n\b")

# Needed to handle 'interesting' implementation of `sort`/`join` on Linux:
LANG="C"
LC_ALL="C"
LC_COLLATE="C"

# This is actually not used, but preserved here for future applications.
#
# Parameters:
#  1. TSV filename. Third column of the TSV needs to hold the score.
#  2. n
#  3. m
#
#    Takes the value from the sorted (descreasing) list of scores at
#    index: column_length * n / m
#
#    For median, use n = 1 and m = 2.
#    For upper quartile, use n = 1 and m = 4.
#    For lower quartile, use n = 3 and m = 4.
#
get_cut_value() {
	index=`cut -f 3 "$1" | sort -n -r | grep -v -w '1' | wc -l`
	let index=index*$2/$3
	if [[ $index -lt 1 ]] ; then index=1 ; fi
	return `cut -f 3 "$1" | sort -n -r | head -n $index | tail -n 1`
}

# Note: Also rewrites identifiers like BMC_Genomics-6--554113 to
#       their PubMed Central ID. Here, the PMC-ID would be 554113.
cut_below() {
	sed -E 's/^.+-([0-9]+)	/\1	/' $2 \
		| ruby -e "STDIN.each { |l|
				l.chomp!
				cols = l.split(\"\\t\")
				puts cols.join(\"\\t\") if cols[-1].to_i >= $1
			}" \
		| sort -k 1 > $2.tmp
}

check_dir() {
	if [ ! -d "./$1" ] ; then
		echo "This script needs to be executed where './$1' is present."
		echo ""
		echo "In other words: the directory '$1' needs to be found in the"
		echo "current working directory when you execute this script."
		exit 1
	fi
}

help_message() {
	echo "Usage: make_opacmo.sh command [prefix]"
	echo ""
	echo "Single host options for 'command':"
	echo "  all          : all of the options below in the listed order"
	echo "  freeze       : jot down the current state of opacmo/bioknack for versioning"
	echo "  get          : download gene and species databases, ontologies and PMC archive"
	echo "  dictionaries : create dictionaries for bioknack's named entity recognition"
	echo "  ner          : run bioknack's named entity recognition ('prefix' applicable)"
	echo "  pner         : run bioknack's parallelized named entity recognition (default)"
	echo "  tsv          : filter and join NER output into TSV files"
	echo "  labels       : create TSV files that map identifiers to readable names"
	echo "  yoctogi      : create denormalized TSV files for loading into Yoctogi"
	echo ""
	echo "High performance cluster options for 'command':"
	echo "  bundle       : execute 'freeze', 'get' and 'dictionaries' from above and then"
	echo "                 creates a tar file ('bundle.tar') for transferral onto a Sun"
	echo "                 Grid Engine powered cluster"
	echo "  sge          : after extracing a bundle from the previous step, continues with"
	echo "                 the steps 'pner' (cluster version), 'tsv', 'labels' and 'yoctogi'"
	echo ""
	echo "The optinal parameter 'prefix' can be used to carry out a NER run on"
	echo "a subset of PMC. For example, the prefix '\"BMC_*\"' restricts the NER run"
	echo "to journal directories starting with 'BMC_'."
}

check_dir 'opacmo'
check_dir 'bioknack'

if [[ $# -lt 1 ]] || [[ $# -gt 2 ]] ; then
	help_message
	exit 1
fi

if [ "$1" != 'all' ] && [ "$1" != 'freeze' ] && [ "$1" != 'get' ] && [ "$1" != 'dictionaries' ] && [ "$1" != 'ner' ] && [ "$1" != 'pner' ] && [ "$1" != 'tsv' ] && [ "$1" != 'labels' ] && [ "$1" != 'yoctogi' ]  && [ "$1" != 'bundle' ] && [ "$1" != 'sge' ]; then
	help_message
	exit 1
fi

prefix=*
data_dir=opacmo_data

# Should the data be denormalised? If you plan to use Yoctogi, then you need to denormalize...
denormalize=1

# If denormalize=1, should we also generate lower case versions of gene-/species- and term-names?
# This is required if MongoDB is used as a backend, because MongoDB cannot generate to indices on
# one column.
lowercase=0

if [[ $# -eq 2 ]] ; then
	prefix=$2
fi

if [ "$1" = 'all' ] || [ "$1" = 'freeze' ] || [ "$1" = 'bundle' ] ; then
	touch STATE_FREEZE
	echo "Freezing current version information..."

	cd bioknack
	git show-ref --head > ../BIOKNACK_REF
	git diff > ../BIOKNACK_DIFF
	cd ..

	cd opacmo
	git show-ref --head > ../OPACMO_REF
	git diff > ../OPACMO_DIFF
	cd ..
	rm -f STATE_FREEZE
fi

if [ "$1" = 'all' ] || [ "$1" = 'get' ] || [ "$1" = 'bundle' ] ; then
	touch STATE_GET
	date > DATA_INFO
	mkdir input dictionaries tmp
	bk_ner_gn.sh minimal
	bk_ner_gn.sh obo
	bk_ner_gn.sh pmc
	rm -f STATE_GET
fi

if [ "$1" = 'all' ] || [ "$1" = 'dictionaries' ] || [ "$1" = 'bundle' ] ; then
	touch STATE_DICTIONARIES
	bk_ner_gn.sh genes
	bk_ner_gn.sh species
	rm -f STATE_DICTIONARIES
fi

if [ "$1" = 'bundle' ] ; then
	tar cf bundle.tar BIOKNACK_REF BIOKNACK_DIFF OPACMO_REF OPACMO_DIFF DATA_INFO opacmo bioknack input dictionaries tmp
	echo "Created the file 'bundle.tar'. Transfer this file onto your cluster,"
	echo "untar it, and then run './make_opacmo.sh continue'."
	exit 0
fi

if [ "$1" = 'all' ] || [ "$1" = 'ner' ] || [ "$1" = 'pner' ] || [ "$1" = 'sge' ] ; then
	if [ "$1" = 'ner' ] ; then
		touch STATE_NER
		if [ ! -d opacmo_data ] ; then mkdir opacmo_data ; fi

		for journal_dir in input/$prefix ; do

			if [ ! -d "$journal_dir" ] ; then continue ; fi

			echo "$journal_dir"
			bk_ner_symlink_dir.sh "$journal_dir"
			bk_ner_gn.sh corpus
			bk_ner_gn.sh ner
			bk_ner_gn.sh score

			if [ ! -f genes.tsv ] ; then touch genes.tsv ; fi
			if [ ! -f species.tsv ] ; then touch species.tsv ; fi
			if [ ! -f terms.tsv ] ; then touch terms.tsv ; fi

			journal_name=`basename "$journal_dir"`
			cp genes.tsv "opacmo_data/${journal_name}__genes.tsv"
			cp species.tsv "opacmo_data/${journal_name}__species.tsv"
			cp terms.tsv "opacmo_data/${journal_name}__terms.tsv"

			rm -f genes.tsv species.tsv terms.tsv
		done
		rm -f STATE_NER
	else
		touch STATE_PNER
		if [ ! -d opacmo_data ] ; then mkdir opacmo_data ; fi
		pmake_opacmo.sh $1
		rm -f STATE_PNER
	fi
fi

if [ "$1" = 'all' ] || [ "$1" = 'tsv' ] || [ "$1" = 'sge' ] ; then
	touch STATE_TSV
	echo "Filtering and joining genes, species and ontology terms..."

	echo " - generating a species white list for filtering species name abbreviations"
	# Create a whitelist of species names to include. Remove genus entities.
	awk -F "\t" '{print $3"\t"$1}' dictionaries/names.dmp | grep -E '^.+ [^	]' \
		| sort -t "	" -k 1,1 > $data_dir/all_species.tmp
	sort -k 1,1 -t "	" tmp/species > $data_dir/species.tmp
	join -t "	" -1 1 -2 1 -o 0,2.2 $data_dir/species.tmp $data_dir/all_species.tmp | uniq \
		| sort -t "	" -k 2,2 > $data_dir/whitelist._tmp

	for genes in $data_dir/*__genes.tsv ; do
		echo " - processing `basename "$genes" __genes.tsv`..."
		species=$data_dir/`basename "$genes" __genes.tsv`__species.tsv
		terms=$data_dir/`basename "$genes" __genes.tsv`__terms.tsv

		tmp=`dirname "$genes"`
		# Postfix is added below. Depends on whether we denormalise or not...
		out=$data_dir/`basename "$genes" __genes.tsv`

		cut_below 3 $genes
		cut_below 3 $species
		cut_below 3 $terms

		sort -t "	" -k 2,2 $species.tmp > $species.tmp2
		join -t "	" -1 2 -2 2 -o 1.1,0,1.3 $species.tmp2 $data_dir/whitelist._tmp \
			| sort -t "	" -k 1 > $species.tmp

		if [[ $denormalize -eq 1 ]] ; then
			join -t "	" -a 1 -a 2 -1 1 -2 1 -o 0,1.2,1.3,2.2,2.3 $genes.tmp $species.tmp > $tmp/genes_species.tmp
			join -t "	" -a 1 -a 2 -1 1 -2 1 -o 0,1.2,1.3,1.4,1.5,2.2,2.3 $tmp/genes_species.tmp $terms.tmp > ${out}__joined.tsv
		else
			cp $genes.tmp ${out}__genes_processed.tsv
			cp $species.tmp ${out}__species_processed.tsv
			cp $terms.tmp ${out}__terms_processed.tsv
		fi

		rm -f $genes.tmp $species.tmp $species.tmp2 $terms.tmp $tmp/*.tmp
	done

	rm -f $data_dir/all_species.tmp $data_dir/whitelist._tmp
	rm -f STATE_TSV
fi

if [ "$1" = 'all' ] || [ "$1" = 'labels' ] || [ "$1" = 'sge' ] ; then
	touch STATE_LABELS
	echo "Generate labels for gene-, species- and ontology-identifiers..."
	bk_ner_fmt_labels.sh
	rm -f STATE_LABELS
fi

if [ "$1" = 'all' ] || [ "$1" = 'yoctogi' ] || [ "$1" = 'sge' ] ; then
	touch STATE_YOCTOGI
	echo "Adding human readable titles, names and terms..."

	# Extract species names and remove genus entities:
	echo " - creating a species name dictionary without genus names"
	grep -E '	.+ [^ ]' species_names.tsv > $data_dir/species_names.tmp

	if [[ $denormalize -eq 1 ]] ; then
		for joined in $data_dir/*__joined.tsv ; do
			if [ ! -f $joined ] ; then continue ; fi

			echo " - processing `basename $joined __joined.tsv`"

			echo "   - generating Yoctogi main table"

			echo "     - adding gene names"
			sort -k 2,2 -t "	" $joined > $joined.tmp
			join -t "	" -a 1 -1 2 -2 1 -o 1.1,2.2,0,1.3,1.4,1.5,1.6,1.7 $joined.tmp gene_names.tsv \
				| awk -F "\t" '{if ($3 == "" || $2 != "") {print $0}}' > $joined.tmp2

			echo "     - adding ontology term-names"
			sort -k 7,7 -t "	" $joined.tmp2 > $joined.tmp
			join -t "	" -a 1 -1 7 -2 1 -o 1.1,1.2,1.3,1.4,1.5,1.6,2.2,0,1.8 $joined.tmp term_names.tsv \
				| awk -F "\t" '{if ($8 == "" || $7 != "") {print $0}}' > $joined.tmp2

			echo "     - adding species names"
			sort -k 5,5 -t "	" $joined.tmp2 > $joined.tmp
			join -t "	" -a 1 -1 5 -2 1 -o 1.1,1.2,1.3,1.4,2.2,0,1.6,1.7,1.8,1.9 $joined.tmp $data_dir/species_names.tmp \
				| awk -F "\t" '{if ($6 == "" || $5 != "") {print $0}}' > $joined.tmp2

			# Convert text fields to lowercase for use with MongoDB. Only convert those fields
			# for which no programmatic solution can be provided to look up even case-sensitive
			# entries.
			if [ $lowercase -eq 1 ] ; then
				echo "     - adding lower case versions of gene- and term-names"
				awk -F "\t" '{
						gene="";
						if ($2 ~ /[A-Z]/) {gene=tolower($2)};
						term="";
						if ($8 ~ /[A-Z]/) {term=tolower($8)};
						print $1"\t"$2"\t"$3"\t"$4"\t"$5"\t"$6"\t"$7"\t"$8"\t"$9"\t"$10"\t"gene"\t"term
					}' $joined.tmp2 \
					> $data_dir/`basename $joined __joined.tsv`__yoctogi.tsv
			else
				mv $joined.tmp2 $data_dir/`basename $joined __joined.tsv`__yoctogi.tsv
			fi

			echo "   - generating Yoctogi dimension table"

			echo "     - publication titles"
			join -t "	" -1 1 -2 1 -o 0,2.2 $joined titles.tsv | uniq \
				> $data_dir/`basename $joined __joined.tsv`__yoctogi_titles.tsv

			rm -f $joined.tmp $joined.tmp2
		done
	else
		for genes in $data_dir/*__genes_processed.tsv ; do
			if [ ! -f $genes ] ; then continue ; fi

			echo " - processing `basename $genes __genes_processed.tsv`"
			species=$data_dir/`basename "$genes" __genes_processed.tsv`__species_processed.tsv
			terms=$data_dir/`basename "$genes" __genes_processed.tsv`__terms_processed.tsv

			# Postfix is added below.
			out=$data_dir/`basename $genes __genes_processed.tsv`

			echo "   - adding gene names"
			sort -k 2,2 -t "	" $genes > $genes.tmp
			join -t "	" -a 1 -1 2 -2 1 -o 1.1,2.2,0,1.3 $genes gene_names.tsv > ${out}__yoctogi_genes.tsv

			echo "   - adding ontology term-names"
			sort -k 2,2 -t "	" $terms > $terms.tmp
			join -t "	" -a 1 -1 2 -2 1 -o 1.1,2.2,0,1.3 $terms term_names.tsv > ${out}__yoctogi_terms.tsv

			echo "   - adding species names"
			sort -k 2,2 -t "	" $species > $species.tmp
			join -t "	" -a 1 -1 2 -2 1 -o 1.1,2.2,0,1.3 $species $data_dir/species_names.tmp > ${out}__yoctogi_species.tsv

			echo "   - adding publication titles"
			join -t "	" -1 1 -2 1 -o 0,2.2 $genes titles.tsv | uniq \
				> ${out}__yoctogi_titles.tsv

			rm -f $genes.tmp $terms.tmp $species.tmp
		done
	fi

	rm -f $data_dir/species_names.tmp
	rm -f STATE_YOCTOGI
fi

