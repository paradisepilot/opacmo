#!/bin/bash

PMCID_FILE=tmp/pmcids.tmp
SAMPLE_FILE_1=tmp/samples1.tmp
SAMPLE_FILE_2=tmp/samples2.tmp

#rm -f $PMCID_FILE
#
#for results in opacmo_data/*__yoctogi_*.tsv ; do
#	<$results cut -f 1 | sort | uniq >> $PMCID_FILE.tmp
#done
#
#<$PMCID_FILE.tmp sort | uniq > $PMCID_FILE
#rm -f $PMCID_FILE.tmp

test_pair() {
	TERM1=$1
	TERM2=$2

	rm -f $SAMPLE_FILE_1 $SAMPLE_FILE_2

	for results in opacmo_data/*__yoctogi_genes.tsv ; do
		<$results grep -E "^[0-9]+	[^	]*	$TERM1	" | cut -f 1,4 | sort -k 1,1 >> $SAMPLE_FILE_1
	done

	for results in opacmo_data/*__yoctogi_terms_do.tsv ; do
		<$results grep -E "^[0-9]+	[^	]*	$TERM2	" | cut -f 1,4 | sort -k 1,1 >> $SAMPLE_FILE_2
	done

	<opacmo/hypothesis_testing.r R --no-save | grep -E -A 30 '^V ='
}

echo -n "BRCA2 vs cancer: "
test_pair 675 'DOID:162' 2> /dev/null

echo -n "BRCA2 vs breast cancer: "
test_pair 675 'DOID:1612' 2> /dev/null

echo -n "BRCA2 vs kidney cancer: "
test_pair 675 'DOID:263' 2> /dev/null

echo -n "BRCA2 vs tonsillitis: "
test_pair 675 'DOID:10456' 2> /dev/null

echo -n "BRCA2 vs common cold: "
test_pair 675 'DOID:10459' 2> /dev/null

echo -n "P53 vs cancer: "
test_pair 7157 'DOID:162' 2> /dev/null

echo -n "P53 vs breast cancer: "
test_pair 7157 'DOID:1612' 2> /dev/null

echo -n "P53 vs kidney cancer: "
test_pair 7157 'DOID:263' 2> /dev/null

echo -n "P53 vs tonsillitis: "
test_pair 7157 'DOID:10456' 2> /dev/null

echo -n "P53 vs common cold: "
test_pair 7157 'DOID:10459' 2> /dev/null

