export function loader() {
  return Response.json(
    { status: "healthy", timestamp: new Date().toISOString() },
    {
      status: 200,
      headers: {
        "Cache-Control": "no-store",
        "Content-Type": "application/json",
      },
    },
  );
}
