
-- create the test sort-bot service account
insert into public."user"
  (id, email, name, username, picture, administrator)
  values
  (
    'svc-sort-bot-test',
    'svc-sort-bot-test@sort.xyz',
    'sort-bot',
    'sort-bot',
    'https://avatars.githubusercontent.com/u/137358238?s=96&v=4',
    false
  );
