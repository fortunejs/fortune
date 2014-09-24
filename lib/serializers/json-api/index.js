module.exports = {
	mediaType: 'application/vnd.api+json',
	processQuery: require('./process_query'),
	showErrors: require('./show_errors'),
	showIndex: require('./show_index'),
	showCollection: require('./show_collection')
};
