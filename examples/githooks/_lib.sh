#!/bin/sh
# Shared helpers for the team git hooks. Sourced, never executed directly.
#
# Everything here exists so the hooks work on ANY language: they depend on the
# standard task interface (install / format-check / lint / typecheck / test /
# test-coverage / build / security), resolved in this order:
#
#   1. make <task>      when a Makefile defines that target
#   2. just <task>      when a justfile defines that recipe
#   3. native detection  per ecosystem (below)
#   4. unresolved        — the caller decides whether that blocks
#
# Keep the globs and mappings here in step with the plugin's
# references/toolchains.md.

have() { command -v "$1" >/dev/null 2>&1; }

# --------------------------------------------------------------- stack detect
detect_stack() {
  if [ -f package.json ]; then echo node
  elif [ -f pyproject.toml ] || [ -f setup.cfg ] || [ -f pytest.ini ] || \
       [ -f requirements.txt ]; then echo python
  elif [ -f go.mod ]; then echo go
  elif [ -f Cargo.toml ]; then echo rust
  elif [ -f pom.xml ]; then echo maven
  elif [ -f build.gradle ] || [ -f build.gradle.kts ]; then echo gradle
  elif [ -f Gemfile ]; then echo ruby
  elif [ -f composer.json ]; then echo php
  elif [ -f mix.exs ]; then echo elixir
  elif [ -f Package.swift ]; then echo swift
  elif [ -f pubspec.yaml ]; then echo dart
  else
    for f in *.sln *.csproj; do
      [ -e "$f" ] && { echo dotnet; return; }
    done
    echo unknown
  fi
}

npm_runner() {
  if [ -f pnpm-lock.yaml ] && have pnpm; then echo "pnpm run"
  elif [ -f yarn.lock ] && have yarn; then echo "yarn"
  elif [ -f bun.lockb ] && have bun; then echo "bun run"
  else echo "npm run --silent"
  fi
}

npm_script() { grep -q "\"$1\"[[:space:]]*:" package.json 2>/dev/null; }

# ------------------------------------------------------------- task resolution
# Echoes the command for a task, or nothing when it cannot be resolved.
resolve_task() {
  task="$1"

  if [ -f Makefile ] && make -n "$task" >/dev/null 2>&1; then
    echo "make $task"; return
  fi
  if [ -f justfile ] && have just && just --show "$task" >/dev/null 2>&1; then
    echo "just $task"; return
  fi

  case "$(detect_stack)" in
    node)
      runner=$(npm_runner)
      case "$task" in
        test)          npm_script test          && echo "$runner test" ;;
        test-coverage) npm_script "test:coverage" && echo "$runner test:coverage" ;;
        lint)          npm_script lint          && echo "$runner lint" ;;
        typecheck)     npm_script typecheck     && echo "$runner typecheck" ;;
        format-check)  npm_script "format:check" && echo "$runner format:check" ;;
        build)         npm_script build         && echo "$runner build" ;;
        security)      echo "npm audit --audit-level=high" ;;
      esac ;;
    python)
      case "$task" in
        test)          have pytest && echo "pytest -q" ;;
        test-coverage) have pytest && echo "pytest -q --cov --cov-report=xml --cov-report=term" ;;
        lint)          have ruff && echo "ruff check ." ;;
        format-check)  have ruff && echo "ruff format --check ." ;;
        typecheck)     if have mypy; then echo "mypy ."; elif have pyright; then echo "pyright"; fi ;;
        security)      have pip-audit && echo "pip-audit" ;;
      esac ;;
    go)
      case "$task" in
        test)          echo "go test ./..." ;;
        test-coverage) echo "go test ./... -coverprofile=coverage.out -covermode=atomic" ;;
        lint)          have golangci-lint && echo "golangci-lint run" ;;
        format-check)  echo "gofmt -l ." ;;
        typecheck)     echo "go build ./..." ;;
        build)         echo "go build ./..." ;;
        security)      have govulncheck && echo "govulncheck ./..." ;;
      esac ;;
    rust)
      case "$task" in
        test)          echo "cargo test --all-features" ;;
        test-coverage) have cargo-llvm-cov && echo "cargo llvm-cov --cobertura --output-path coverage.xml" ;;
        lint)          echo "cargo clippy --all-targets -- -D warnings" ;;
        format-check)  echo "cargo fmt --check" ;;
        typecheck)     echo "cargo check --all-targets" ;;
        build)         echo "cargo build --release" ;;
        security)      have cargo-audit && echo "cargo audit" ;;
      esac ;;
    maven)
      case "$task" in
        test) echo "mvn -B -q test" ;; build) echo "mvn -B -q package -DskipTests" ;;
      esac ;;
    gradle)
      case "$task" in
        test) echo "./gradlew test" ;; build) echo "./gradlew assemble" ;;
      esac ;;
    ruby)
      case "$task" in
        test)         [ -d spec ] && echo "bundle exec rspec" || echo "bundle exec rake test" ;;
        lint)         have rubocop && echo "bundle exec rubocop" ;;
        security)     have bundle-audit && echo "bundle audit check --update" ;;
      esac ;;
    php)
      case "$task" in
        test)     [ -x vendor/bin/phpunit ] && echo "vendor/bin/phpunit" ;;
        security) echo "composer audit" ;;
      esac ;;
    elixir)
      case "$task" in
        test) echo "mix test" ;; format-check) echo "mix format --check-formatted" ;;
        typecheck) echo "mix dialyzer" ;;
      esac ;;
    dotnet)
      case "$task" in
        test) echo "dotnet test" ;; build) echo "dotnet build" ;;
        format-check) echo "dotnet format --verify-no-changes" ;;
      esac ;;
    swift)
      case "$task" in test) echo "swift test" ;; build) echo "swift build" ;; esac ;;
    dart)
      case "$task" in
        test) [ -f pubspec.yaml ] && grep -q flutter pubspec.yaml && echo "flutter test" || echo "dart test" ;;
        lint) echo "dart analyze" ;;
        format-check) echo "dart format --set-exit-if-changed ." ;;
      esac ;;
  esac
}

# Runs a task. Returns: 0 pass, 1 fail, 127 unresolved (nothing was run).
run_task() {
  cmd=$(resolve_task "$1")
  [ -n "$cmd" ] || return 127
  echo "→ $1: $cmd"
  # shellcheck disable=SC2086
  sh -c "$cmd"
}

# ------------------------------------------------------------------ file kinds
is_test_file() {
  case "$1" in
    *.test.*|*.spec.*|*_test.*|*_spec.*|test_*.py|*Test.java|*Tests.java|\
    *Test.kt|*Tests.cs|*Spec.scala|*__tests__*|*/tests/*|*/test/*|*/spec/*|\
    tests/*|test/*|spec/*) return 0 ;;
    *) return 1 ;;
  esac
}

# Logic source REQUIRES an accompanying test change. Exempt: tests, docs,
# config, styles, assets, migrations, generated code.
is_logic_source() {
  is_test_file "$1" && return 1
  case "$1" in
    *.md|*.mdx|*.txt|*.rst|*.json|*.yml|*.yaml|*.toml|*.ini|*.cfg|*.lock|*.sum) return 1 ;;
    *.css|*.scss|*.less|*.svg|*.png|*.jpg|*.jpeg|*.webp|*.gif|*.ico|*.woff*|*.ttf) return 1 ;;
    *.d.ts|*generated*|*_pb2.py|*.pb.go|*/migrations/*|migrations/*) return 1 ;;
    *.config.js|*.config.ts|*.config.mjs|*.config.mts|*.config.cjs) return 1 ;;
    *.ts|*.tsx|*.js|*.jsx|*.mjs|*.cjs|*.vue|*.svelte) return 0 ;;
    *.py|*.go|*.rs|*.rb|*.php|*.java|*.kt|*.kts|*.scala|*.cs|*.fs|*.swift|\
    *.m|*.mm|*.c|*.cc|*.cpp|*.h|*.hpp|*.ex|*.exs|*.dart|*.erl|*.clj|*.sh|*.bash) return 0 ;;
    *) return 1 ;;
  esac
}
