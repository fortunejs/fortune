# Contributing

The [main repository is on GitHub](https://github.com/fortunejs/fortune). Here's what you need to do:

1. Fork it.
2. Install development dependencies with `npm install`.
3. Update files, make sure the code lints and the tests pass by running `npm test`.
4. Commit, push, and submit a pull request.


### External components

When publishing components, please prefix the name with "`fortune-`" so that it may be discoverable. Also let [me](mailto:d@liwa.li) know that it's published.

The Adapter class has a standard set of tests that must pass. To run the tests, you must install the modules `fortune` and `tape` to your module's `devDependencies`:

```sh
$ npm install fortune tape --save-dev
```

Then to run the adapter test, import the module:

```js
import testAdapter from 'fortune/test/unit/adapter'
testAdapter(adapter, options)
```

The function accepts two arguments, the adapter class or function, and the options to pass to the constructor.


### What to contribute

Issues are tracked on [GitHub](https://github.com/fortunejs/fortune/issues). Beyond submitting code, a few things would be nice:

- Guides on how to use Fortune.
- Changes to documentation are welcome.
- Promotional materials (graphics would be nice).
