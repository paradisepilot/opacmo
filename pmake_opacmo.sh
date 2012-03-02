#!/bin/bash

environment=$1

# Soft limit on maximum number of processes that should be running in parallel.
# Since make_opacmo.sh sets STATE_NER late, there is the possibility that we
# fork more instances than given here just because the 'scheduler' is not aware
# of a freshly spawned process.
if [ "$environment" != 'sge' ] ; then
	max_processes=4
else
	max_processes=100
fi

# Determines the number of cores available on clusters nodes.
# Unless you use Ruby 1.9 or (even better) JRuby, leaving the
# cores set to one is the best option. There will simply be no
# multi-threading in Ruby 1.8.
cores=1

# Memory that should be reserved on cluster nodes.
maxmem=8G

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
	if [ "$1" = 'pner' ] ; then
		make_opacmo.sh $cmd "`basename $journal`" &> FORK_LOG &
		sleep 1
	else
		qsub -cwd -N "opacmo.`basename $journal`" -l h_vmem=$maxmem -pe smp $cores -b y "opacmo/make_opacmo.sh $cmd \"`basename $journal`\" &> FORK_LOG"
		sleep 5
	fi

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

