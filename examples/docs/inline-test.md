# Inline Datasource Test

Simple test for inline datasources.

## Data Definition

<!--@embedoc-data:project format="yaml"-->
name: test-project
version: 1.0.0
<!--@embedoc-data:end-->

## Usage

Project name: <!--@embedoc:inline_value datasource="project" path="name"-->
test-project
<!--@embedoc:end-->

