[![Build Status](https://travis-ci.org/agco/harvester.svg?branch=develop)](https://travis-ci.org/agco-adm/harvester)
# Harvester.js 

[Fortune](https://travis-ci.org/daliwali/fortune) fork which aims to be fully json-api compliant.

Pluggable with the [agco-adm JSON-API search](https://github.com/agco-adm/json-api-search-profile) profile implementation : [Elastic Harvester](https://github.com/agco-adm/elastic-harvester), which offers additional features such as [linked resource filtering and aggregation](https://github.com/agco-adm/json-api-search-profile/blob/master/public/profile.md).   

### JSON-API Features 

- [Resource Relationships](http://jsonapi.org/format/#document-structure-resource-relationships) 
- [URL Templates](http://jsonapi.org/format/#document-structure-url-templates)
- [Filtering](http://jsonapi.org/format/#fetching-filtering)
- [Inclusion of Linked Resources](http://jsonapi.org/format/#fetching-includes)
- [Sparse fieldsets](http://jsonapi.org/format/#fetching-sparse-fieldsets)
- [Sorting](http://jsonapi.org/format/#fetching-sorting)
- [CRUD](http://jsonapi.org/format/#crud)
- [Errors](http://jsonapi.org/format/#errors)

### Other Features 

- Offset based pagination
- node-swagger-express ready

### Roadmap

- Extended filter operators : lt, gt, lte, gte
- Mongodb change events - oplog integration 
- External links
- UUIDs 
- [Patch](http://jsonapi.org/format/#patch) fully supported
- [Creating](http://jsonapi.org/format/#crud-creating-multiple-resources) and [Updating multiple resources](http://jsonapi.org/format/#crud-updating-multiple-resources)

