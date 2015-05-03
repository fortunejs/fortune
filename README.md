[![Fortune.js](https://fortunejs.github.io/fortune-website/assets/fortune_logo.svg)](http://fortunejs.com)

[![Build Status](https://img.shields.io/travis/fortunejs/fortune/rewrite.svg?style=flat-square)](https://travis-ci.org/fortunejs/fortune)
[![npm Version](https://img.shields.io/npm/v/fortune.svg?style=flat-square)](https://www.npmjs.com/package/fortune)
[![License](https://img.shields.io/npm/l/fortune.svg?style=flat-square)](https://www.npmjs.com/package/fortune)
[![Piggu](https://img.shields.io/badge/pigs-flying-fca889.svg?style=flat-square)](http://fortunejs.com)

**Fortune** is a library for persisting and manipulating data, intended to provide building blocks for web applications.

[View the website](http://fortunejs.com) for documentation. Get it from `npm`:

```sh
$ npm install fortune
```


## Key Concepts

- Stateless request and response workflow.
- Two interchangeable components: the **adapter** and **serializers**.
- The adapter interacts with data storage.
- Serializers parse requests and render responses.
- Networking is optional, may be handled by serializers.


## Hypermedia Applications

Fortune gives you hypermedia serializers for free. Given the definitions of the record types, it is able to construct a [domain ontology](https://en.wikipedia.org/wiki/Ontology_(information_science)#Domain_ontology). This is useful for generating hyperlinks to entities that compose records and their relationships.


## License

Fortune is licensed under the [MIT license](https://raw.githubusercontent.com/fortunejs/fortune/rewrite/LICENSE).
