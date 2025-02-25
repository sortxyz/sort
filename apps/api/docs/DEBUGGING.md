# Debugging the API

This document outlines how to debug this API in either the development or
production AWS environments. The steps for debugging both environments is the
same unless otherwise noted.

## Sentry

Typically you'll start debugging a production issue by investigating a bug
report on [Sentry][], a bug capture service. Here's an example:

<img width="600" src="./sentry.png">

Sometimes there is enough information in the bug report to determine what went
wrong but when you need more information about the request, you'll need to copy
the `reqId` value from the Sentry bug report and head over to [AWS Cloudwatch Logs Insights][].

## More information

For more example queries which you can copy / paste into Cloudwatch Insights, please take a look at our [document on Notion][Log Insights Examples].

[Sentry]: https://sortxyz.sentry.io/issues/?project=4504889143721984&query=&referrer=issue-stream&statsPeriod=7d&stream_index=3
