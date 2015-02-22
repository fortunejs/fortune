# Commands
COMPILE_CMD = node_modules/.bin/babel

# Directories
LIB_DIR = lib/
DIST_DIR = dist/
TEST_DIR = test/

all: compile-lib compile-test

compile-lib:
	mkdir -p $(DIST_DIR)
	$(COMPILE_CMD) --optional runtime $(LIB_DIR) \
		--out-dir $(DIST_DIR)

compile-test:
	mkdir -p $(DIST_DIR)$(TEST_DIR)
	$(COMPILE_CMD) --optional runtime $(TEST_DIR) \
		--out-dir $(DIST_DIR)$(TEST_DIR)

clean:
	rm -rf $(DIST_DIR)
