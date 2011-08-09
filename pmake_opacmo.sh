#!/bin/bash

cmd=$1
shift

fork=0

while [[ $# -gt 0 ]] ; do
	forkdir=fork_$fork

	rm -rf $forkdir
	mkdir $forkdir
	cd $forkdir
	mkdir input ; cd input ; ln -s ../../input/$1 ; cd ..
	ln -s ../dictionaries
	mkdir tmp ; cd tmp ; ln -s ../../tmp/* . ; cd ..
	ln -s ../bioknack
	ln -s ../opacmo
	mkdir opacmo_data

	make_opacmo.sh $cmd $1

	if [ "$cmd" = 'all' ] || [ "$cmd" = 'ner' ] ; then
		mv opacmo_data/* ../opacmo_data
	fi

	cd ..
	let fork=fork+1
	shift
done

