# Inline Datasource Test

Simple test for inline datasources.

## Data Definition

<!--@embedify-data:project format="yaml"-->
name: test-project
version: 1.0.0
<!--@embedify-data:end-->

## Usage

Project name: <!--@embedify:inline_value datasource="project" path="name"-->
test-project
<!--@embedify:end-->

