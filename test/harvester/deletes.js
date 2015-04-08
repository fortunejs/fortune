var should = require('should');
var _ = require('lodash');
var $http = require('http-as-promised');

module.exports = function(baseUrl,keys,ids) {

    describe("deletes", function() {
        it("Should handle deletes with a 204 statusCode",function(){
            return $http.del(baseUrl+"/people/"+ids.people[0],{json:{}})
                .spread(function(res,body){
                    res.statusCode.should.equal(204);
                    delete ids.people[0];
                })
        });
    });
};