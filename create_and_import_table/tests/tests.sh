#!/bin/sh

TEST=$(sh create_and_import_table.sh tests/file_cr.csv table key debug)
echo CR: ${TEST}
[ "$TEST" == '`field1` varchar(512),`field with spaces` varchar(512),`field3` varchar(512), PRIMARY KEY (`key`)::CR' ] && echo PASSED || echo FAILED
echo ""
TEST=$(sh create_and_import_table.sh tests/file_lf.csv table key debug)
echo LF: ${TEST}
[ "$TEST" == '`field1` varchar(512),`field with spaces` varchar(512),`field3` varchar(512), PRIMARY KEY (`key`)::LF' ] && echo PASSED || echo FAILED
echo ""
TEST=$(sh create_and_import_table.sh tests/file_crlf.csv table key debug)
echo CRLF: ${TEST}
[ "$TEST" == '`field1` varchar(512),`field with spaces` varchar(512),`field3` varchar(512), PRIMARY KEY (`key`)::CRLF' ] && echo PASSED || echo FAILED
