#!/bin/bash

PATH=$PATH:./bioknack
IFS=$(echo -e -n "\n\b")

median() {
	index=`cut -f 3 "$1" | sort -n -r | grep -v -E '1$' | wc -l`
	let index=index/2
	return `cut -f 3 "$1" | sort -n -r | head -n $index | tail -n 1`
}

cut_below_median() {
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

if [ "$1" != 'all' ] && [ "$1" != 'get' ] && [ "$1" != 'ner' ] ; then
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
	for genes in $data_dir/*__genes.tsv ; do
		species=$data_dir/`basename "$genes" __genes.tsv`__species.tsv
		terms=$data_dir/`basename "$genes" __genes.tsv`__terms.tsv

		tmp=`dirname "$genes"`
		out=$data_dir/`basename "$genes" __genes.tsv`__joined.tsv

		median $genes ; genes_median=$?
		median $species ; species_median=$?
		median $terms ; terms_median=$?

		cut_below_median $genes_median $genes
		cut_below_median $species_median $species
		cut_below_median $terms_median $terms

		join -t "	" -a 1 -a 2 -1 1 -2 1 -o 0,1.2,1.3,2.2,2.3 $genes.tmp $species.tmp > $tmp/genes_species.tmp
		join -t "	" -a 1 -a 2 -1 1 -2 1 -o 0,1.2,1.3,1.4,1.5,2.2,2.3 $tmp/genes_species.tmp $terms.tmp > $out

		rm -f $genes.tmp $species.tmp $terms.tmp $tmp/*.tmp
	done
fi

