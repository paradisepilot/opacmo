#!/bin/bash

# Soft limit on maximum number of processes that should be running in parallel.
# Since make_opacmo.sh sets STATE_NER late, there is the possibility that we
# fork more instances than given here just because the 'scheduler' is not aware
# of a freshly spawned process.
max_processes=4

cmd=ner
fork=0

function scheduler() {
	local running=$max_processes
	while [[ $running -ge $max_processes ]] ; do
		running=0
		for forks in fork_* ; do
			if [ -f $forks/STATE_NER ] ; then
				let running=running+1
			fi
		done
		if [[ $running -ge $max_processes ]] ; then sleep 5 ; fi
	done

	return $running
}

if [ ! -d opacmo_data ] ; then mkdir opacmo_data ; fi

for journal in input/* ; do
	if [ ! -d "$journal" ] ; then continue ; fi

	scheduler

	forkdir=fork_$fork

	rm -rf $forkdir
	mkdir $forkdir
	cd $forkdir
	mkdir input ; cd input ; ln -s ../../$journal ; cd ..
	ln -s ../dictionaries
	mkdir tmp ; cd tmp ; ln -s ../../tmp/* . ; cd ..
	ln -s ../bioknack
	ln -s ../opacmo
	ln -s ../opacmo_data

	echo "Processing in background: $journal"
	make_opacmo.sh $cmd `basename $journal` &> FORK_LOG &
	sleep 1

	cd ..
	let fork=fork+1
	shift
done

scheduler
while [[ $? -ne 0 ]] ; do
	sleep 5
	scheduler
done

echo "Processed background processes: $fork"

