#!/bin/bash

tmp_dir=$(mktemp -d)
real_dir=$(pwd)

echo $tmp_dir

if test -f "$real_dir/.env"; then
    mkdir -p "$tmp_dir"
    mv -vf "$real_dir/.env" "$tmp_dir/.env"
fi

if test -f "$real_dir/e2e/.env"; then
    mkdir -p "$tmp_dir/e2e"
    mv -vf "$real_dir/e2e/.env" "$tmp_dir/e2e/.env"
fi

git clean -dfx

if test -f "$tmp_dir/.env"; then
    mv -vf "$tmp_dir/.env" "$real_dir/.env"
fi

if test -f "$tmp_dir/e2e/.env"; then
    mv -vf "$tmp_dir/e2e/.env" "$real_dir/e2e/.env"
fi

rm -rf "$tmp_dir"
