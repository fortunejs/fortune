#!/bin/sh
status=0

# run same set of tests per adapter
for adapter in nedb mongodb mysql
do
	node 'test/run' $adapter
	if [ $? -eq 0 ]
	then
		continue
	else
		status=1
	fi
done

exit $status
