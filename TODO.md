# TODO

1. ~~Fork fortune~~
2. ~~Define our action module~~
3. ~~Modify fortune.js on line 197+~~
	* Process the action sub object in our options object
	* Pass this over to our actions module
4. Modify fortune routing logic to handle /action/ route and pass control to actionModule.handleAction()

```
	/users/:id/action/reset-password

	/users/

	({
		resource: string,
		id: string,
		action: sting,
		cb: function
	})
```