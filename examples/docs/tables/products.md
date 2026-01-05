---
doc_id: "products"
doc_type: "table"
schema: "public"
embeds:
  - table_columns
  - table_relations
---
# Table Specification: products

## Overview

| Item | Value |
|------|-------|
| Schema | public |
| Table Name | products |
| Description | Table for managing product information |

## Column Definitions

<!--@embedoc:table_columns id="products"-->
| Column Name | Type | NOT NULL | Default | Comment |
| --- | --- | --- | --- | --- |
| id | integer | ✔ | NULL | Product ID |
| name | varchar(200) | ✔ | NULL | Product name |
| price | decimal(10,2) | ✔ | 0 | Price |
| stock | integer | ✔ | 0 | Stock quantity |
<!--@embedoc:end-->

## Table Dependencies

<!--@embedoc:table_relations id="products"-->
⚠️ No relations found for table: products
<!--@embedoc:end-->

## Change History

| Date       | Version | Author  | Description          |
| ---------- | ------- | ------- | -------------------- |
| 2025-12-17 | 1.0.0   | -       | Auto-generated from template |
