#!/bin/sh

MYSQL_ARGS="--local-infile -u root"
DB="mydb"
DELIM=","

CSV="$1"
TABLE="$2"
KEY="$3"

[ "$CSV" = "" -o "$TABLE" = "" ] && echo "Syntax: $0 csvfile tablename [keycolumn]" && exit 1

FIELDS=$(head -1 "$CSV" | tr -d "\r" | sed -e 's/'$DELIM'/` varchar(512),`/g' | sed -e 's/"//g')
FIELDS='`'"$FIELDS"'` varchar(512)'
[ "$KEY" != "" ] && FIELDS="$FIELDS"', PRIMARY KEY (`'"$KEY"'`)'

LINE_ENDINGS=$(file "$CSV" | grep "CRLF" 2>&1 1>/dev/null && echo '\\r\\n' || echo '\\n')

#echo "$FIELDS" && exit

mysql $MYSQL_ARGS $DB -e "
DROP TABLE IF EXISTS $TABLE;
CREATE TABLE $TABLE ($FIELDS);
"

read -p "Alter table as you wish. Then press Enter to load data."

mysql $MYSQL_ARGS $DB -e "
LOAD DATA LOCAL INFILE '$(pwd)/$CSV' INTO TABLE $TABLE
FIELDS TERMINATED BY '$DELIM'
OPTIONALLY ENCLOSED BY '\"'
LINES TERMINATED BY '$LINE_ENDINGS'
IGNORE 1 LINES;
"