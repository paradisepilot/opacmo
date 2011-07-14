#!/bin/bash

PATH=$PATH:./bioknack
IFS=$(echo -e -n "\n\b")

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

cut_below() {
	sed -E 's/^.+-([0-9]+)	/\1	/' $2 \
		| ruby -e "STDIN.each { |l|
				l.chomp!
				cols = l.split(\"\\t\")
				puts cols.join(\"\\t\") if cols[-1].to_i >= $1
			}" \
		| sort -k 1 > $2.tmp
}

if [[ $# -lt 1 ]] || [[ $# -gt 2 ]] ; then
	echo "TODO: help message"
	exit
fi

if [ "$1" != 'all' ] && [ "$1" != 'get' ] && [ "$1" != 'ner' ] && [ "$1" != 'tsv' ] ; then
	echo "TODO: help message"
	exit
fi

prefix=*
data_dir=opacmo_data

if [[ $# -eq 2 ]] ; then
	prefix=$2
fi

if [ "$1" = 'all' ] || [ "$1" = 'get' ] ; then
	date > DATA_INFO
	bk_ner_gn.sh minimal
	bk_ner_gn.sh obo
	bk_ner_gn.sh pmc
fi

if [ "$1" = 'all' ] || [ "$1" = 'ner' ] ; then
	if [ ! -d opacmo_data ] ; then mkdir opacmo_data ; fi

	for journal_dir in input/$prefix ; do

		if [ ! -d "$journal_dir" ] ; then continue ; fi

		echo "$journal_dir"
		bk_ner_symlink_dir.sh "$journal_dir"
		bk_ner_gn.sh corpus
		bk_ner_gn.sh ner
		bk_ner_gn.sh score

		journal_name=`basename "$journal_dir"`
		cp genes.tsv "opacmo_data/${journal_name}__genes.tsv"
		cp species.tsv "opacmo_data/${journal_name}__species.tsv"
		cp terms.tsv "opacmo_data/${journal_name}__terms.tsv"

		rm -f genes.tsv species.tsv terms.tsv
	done
fi

if [ "$1" = 'all' ] || [ "$1" = 'tsv' ] ; then
	echo "Joining genes, species and ontology terms..."
	for genes in $data_dir/*__genes.tsv ; do
		echo " - processing `basename "$genes" __genes.tsv`..."
		species=$data_dir/`basename "$genes" __genes.tsv`__species.tsv
		terms=$data_dir/`basename "$genes" __genes.tsv`__terms.tsv

		tmp=`dirname "$genes"`
		out=$data_dir/`basename "$genes" __genes.tsv`__joined.tsv

		cut_below 3 $genes
		cut_below 3 $species
		cut_below 3 $terms

		join -t "	" -a 1 -a 2 -1 1 -2 1 -o 0,1.2,1.3,2.2,2.3 $genes.tmp $species.tmp > $tmp/genes_species.tmp
		join -t "	" -a 1 -a 2 -1 1 -2 1 -o 0,1.2,1.3,1.4,1.5,2.2,2.3 $tmp/genes_species.tmp $terms.tmp > $out

		rm -f $genes.tmp $species.tmp $terms.tmp $tmp/*.tmp
	done
fi

