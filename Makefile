NPM ?= npm
NPX ?= npx
PLAYWRIGHT_BROWSER ?= chromium

.DEFAULT_GOAL := help

.PHONY: help install playwright-install dev start \
	lint typecheck content content-ready unit unit-functional \
	test check check-functional \
	build build-verify bundle-check bundle-baseline \
	e2e e2e-production \
	lighthouse lighthouse-summarize container verify ci \
	clean fclean re

help:
	@printf '%s\n' \
		'Usage: make <target>' \
		'' \
		'Setup and development:' \
		'  install              Install the locked dependency graph with npm ci' \
		'  playwright-install   Install the selected Playwright browser' \
		'  dev                  Start the webpack development server on port 3100' \
		'  start                Start an existing production build on port 3100' \
		'' \
		'Fast validation:' \
		'  lint                 Run ESLint' \
		'  typecheck            Run TypeScript without emitting files' \
		'  content              Validate content schemas, references, and assets' \
		'  content-ready        Validate publication readiness for the active mode' \
		'  test                 Run the Vitest suite once' \
		'  check                Run content, lint, typecheck, and unit checks' \
		'  check-functional     Run executable checks without documentation-link policy' \
		'' \
		'Build and browser validation:' \
		'  build                Create the standalone production build' \
		'  build-verify         Verify the standalone build artifacts' \
		'  bundle-check         Check route bundles against committed budgets' \
		'  e2e                  Run Playwright against the development server' \
		'  e2e-production       Build and run all production Playwright tests' \
		'  lighthouse           Run the production Lighthouse budget' \
		'  container            Verify the built Docker image and public assets' \
		'  verify               Run check plus non-visual production E2E/build gates' \
		'  ci                   Extend verify with Lighthouse and container gates' \
		'' \
		'Baseline maintenance:' \
		'  bundle-baseline      Replace the committed route bundle baseline' \
		'  lighthouse-summarize Summarize existing Lighthouse reports' \
		'' \
		'Cleanup:' \
		'  clean                Remove build and test artifacts' \
		'  fclean               clean, then remove node_modules' \
		'  re                   fclean, then reinstall and rebuild' \
		'' \
		'Overrides: NPM, NPX, PLAYWRIGHT_BROWSER'

install:
	$(NPM) ci

playwright-install:
	$(NPX) playwright install $(PLAYWRIGHT_BROWSER)

dev:
	$(NPM) run dev

start:
	$(NPM) run start

lint:
	$(NPM) run lint

typecheck:
	$(NPM) run typecheck

content:
	$(NPM) run content:check

content-ready:
	$(NPM) run content:ready

unit:
	$(NPM) run test

unit-functional:
	$(NPM) run test:functional

test: unit

check: content lint typecheck unit

check-functional:
	$(MAKE) content
	$(MAKE) lint
	$(MAKE) typecheck
	$(MAKE) unit-functional

build:
	$(NPM) run build

build-verify:
	$(NPM) run build:verify

bundle-check:
	$(NPM) run bundle:check

bundle-baseline:
	$(NPM) run bundle:baseline

e2e:
	$(NPM) run test:e2e

e2e-production:
	$(NPM) run test:e2e:production

lighthouse:
	$(NPM) run lighthouse:audit

lighthouse-summarize:
	$(NPM) run lighthouse:summarize

container:
	$(NPM) run test:container

# test:e2e:ci performs the production build. The following gates deliberately
# reuse that output instead of paying for a second build.
verify: check-functional
	$(NPM) run test:e2e:ci
	$(NPM) run build:verify
	$(NPM) run bundle:check

ci: verify
	$(NPM) run lighthouse:audit
	$(NPM) run test:container

clean:
	rm -rf .next coverage playwright-report test-results .lighthouseci lighthouse-reports

fclean: clean
	rm -rf node_modules

re: fclean
	$(NPM) ci
	$(NPM) run build
