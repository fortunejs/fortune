#!/bin/sh

REPO_GIT=git@github.com:fortunejs/fortune.git

# Deploying to GitHub pages.
(cd dist; \
	[ ! -d .git ] && \
		git init && \
		git remote add origin $REPO_GIT && \
		git branch gh-pages; \
	git pull origin gh-pages && \
	git checkout gh-pages && \
	git add -A && \
	git commit -m 'Update website from deploy script.' && \
	git push -u origin gh-pages)
