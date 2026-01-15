# Running Scripts with uv

## Overview

This documentation page explains how to use `uv` to execute Python scripts with automatic dependency management and environment creation.

## Running a Script Without Dependencies

Scripts with no external dependencies can be executed using `uv run example.py`. Scripts using only standard library modules work the same way without additional configuration.

Arguments can be passed to scripts, and content can be read from stdin using `uv run -`.

### Important Note: Project Context

When `uv run` is used in a project directory containing `pyproject.toml`, it automatically installs the project first. The `--no-project` flag skips this behavior.

## Running Scripts With Dependencies

When scripts require external packages, dependencies must be declared. Three approaches are supported:

1. **Per-invocation requests**: Using the `--with` flag
2. **Inline metadata**: Using PEP 723 script metadata format
3. **Project declarations**: Within a project structure

### Per-Invocation Dependencies

The `--with` option allows requesting dependencies per invocation:

```bash
uv run --with rich example.py
```

Multiple dependencies can be specified by repeating the flag. Version constraints work with the `--with` option:

```bash
uv run --with 'rich>12,<13' example.py
```

## Creating Python Scripts

The `uv init --script` command initializes scripts with inline metadata support, allowing Python version selection and dependency definition within the script file itself.

## Declaring Script Dependencies

Dependencies can be added using `uv add --script`:

```bash
uv add --script example.py 'requests<3' 'rich'
```

This command inserts a TOML-formatted `script` section at the file's top containing dependency declarations.

## Inline Script Metadata Format

The inline metadata format allows the dependencies for a script to be declared in the script itself. Dependencies and Python version requirements are specified in a comment block:

```python
# /// script
# dependencies = ["requests<3", "rich"]
# requires-python = ">=3.12"
# ///
```

### Important Behavior

When using inline script metadata, even if `uv run` is used in a project, the project's dependencies will be ignored.

## Shebangs and Executable Scripts

Scripts can be made executable with a shebang:

```python
#!/usr/bin/env -S uv run --script
```

After setting the executable permission with `chmod +x`, the script can be run directly without the `uv run` prefix. Dependencies can be declared within these executable scripts.

## Alternative Package Indexes

The `--index` option supports custom package repositories:

```bash
uv add --index "https://example.com/simple" --script example.py
```

## Locking Dependencies

The `uv lock --script example.py` command creates `.lock` files for reproducible script execution. The lock file is created adjacent to the script, enabling reproducible dependency resolution for subsequent runs.

Subsequent operations reuse locked dependencies.

## Reproducibility Features

An `exclude-newer` field in inline metadata limits dependency resolution to distributions released before a specified RFC 3339 timestamp, improving long-term reproducibility.

## Python Version Management

Scripts can specify required Python versions via `requires-python` metadata:

```python
# /// script
# requires-python = ">=3.12"
# ///
```

The `--python` flag allows runtime version overrides:

```bash
uv run --python 3.10 example.py
```

## GUI Scripts

Windows users can execute `.pyw` files using `pythonw` automatically. GUI frameworks like tkinter and PyQt5 are supported with dependency declarations.

Example:

```bash
uv run --with PyQt5 example_pyqui.pyw
```

Dependencies work the same way as regular scripts.

## Summary

The `uv` tool emphasizes on-demand environment creation rather than maintaining long-lived virtual environments with manually managed dependencies. It provides:

- Simple script execution without dependencies
- Multiple methods for declaring dependencies
- Automatic environment management
- Reproducible builds through locking
- Python version control
- Support for executable scripts and GUI applications
- Custom package index support
