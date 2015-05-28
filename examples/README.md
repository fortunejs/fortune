# Examples

## Setup Prerequisites

[Nodejs](https://github.com/joyent/node/wiki/Installation)
[Docker and Compose](https://docs.docker.com/compose/install/)

## Running the examples

### Start Mongodb

Issue the following commmand in the examples dir

    docker-compose up -d
    
This should bring up Mongodb

### Enable the Oplog
  
In order for the [streaming change events](https://github.com/agco/agco-json-api-profiles/blob/master/public/change-events-profile.md#stream-changes) 
feature to work you will need to enable the oplog  
  
As a one-off execute the replSet.sh file, this will initiate a replication set and hence wake up the oplog feature.

    ./replSet.sh
    

### Run an example 

#### Artists insert and stream
 
    node artists_insertAndStream.js
    
This will start up an change events consumer and insert a new entry after a couple of seconds, you should see the output of both actions in the console
  
The resource can be accessed at the following url 

    http://localhost:1337/artists
 
