#!/bin/sh

MYSQL_ARGS="--local-infile -u root"
DB="mydb"
DELIM=","

CSV="$1"
TABLE="$2"
KEY="$3"
DEBUG="$4"

[ "$CSV" = "" -o "$TABLE" = "" ] && echo "Syntax: $0 csvfile tablename [keycolumn]" && exit 1

if [ ! -f "$CSV" ]; then
    echo "File $CSV not found" && exit 1
fi

FIELDS=$(perl -pe 's/\r\n|\n|\r/\n/g' "$CSV" | head -1 | sed -e 's/'$DELIM'/` varchar(512),`/g' | sed -e 's/"//g')
FIELDS='`'"$FIELDS"'` varchar(512)'
[ "$KEY" != "" ] && FIELDS="$FIELDS"', PRIMARY KEY (`'"$KEY"'`)'

if file "$CSV" | grep " CRLF " 2>&1 1>/dev/null ; then
    LINE_ENDINGS='CRLF'
    LINE_ENDINGS_CHAR='\\r\\n'
elif file "$CSV" | grep " CR " 2>&1 1>/dev/null ; then
    LINE_ENDINGS='CR'
    LINE_ENDINGS_CHAR='\\r'
else
    LINE_ENDINGS='LF'
    LINE_ENDINGS_CHAR='\\n'
fi
[ "$DEBUG" != "" ] && printf "$FIELDS::$LINE_ENDINGS" && exit

mysql $MYSQL_ARGS $DB -e "
DROP TABLE IF EXISTS $TABLE;
CREATE TABLE $TABLE ($FIELDS);
"

read -p "Alter table as you wish. Then press Enter to load data."

mysql $MYSQL_ARGS $DB -e "
LOAD DATA LOCAL INFILE '$(pwd)/$CSV' INTO TABLE $TABLE
FIELDS TERMINATED BY '$DELIM'
OPTIONALLY ENCLOSED BY '\"'
LINES TERMINATED BY '$LINE_ENDINGS_CHAR'
IGNORE 1 LINES;
"