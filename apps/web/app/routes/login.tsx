import type { ActionFunctionArgs, MetaDescriptor } from "react-router";
import { data, redirect } from "react-router";
import { ActionForm } from "~/components/action-form";
import { Article } from "~/components/article";
import { Button } from "~/components/button";
import { login } from "~/services/login.server";
import { serverEnv } from "~/utils/env.server";
import { setFlashHeaders } from "~/utils/flash";
import { isRedirect } from "~/utils/response";

export function meta() {
  return [
    {
      title: "Login",
    },
  ] satisfies MetaDescriptor[];
}

export function loader() {
  if (serverEnv.SORT_AUTH === "auth0") {
    return redirect("/api/auth/login");
  }
  return {};
}

export async function action({ request }: ActionFunctionArgs) {
  try {
    await login(request, "form");
  } catch (error) {
    if (error instanceof Response && isRedirect(error)) {
      throw error;
    }
    console.error(error);

    return data(
      {},
      {
        status: 401,
        headers: await setFlashHeaders({
          type: "error",
          message: "Invalid email or password",
        }),
      },
    );
  }
}

export default function Route() {
  return (
    <Article>
      <div className="pt-10 pl-12">
        <h3 className="flex items-center gap-2 pb-5 text-xl font-semibold text-gray-900 md:text-3xl md:font-bold">
          Log In
        </h3>
        <div className="">
          <ActionForm method="post" className="max-w-md">
            <label
              className="text-sm font-medium text-gray-900"
              htmlFor="email"
            >
              Email
            </label>
            <div className="relative flex grow items-center gap-3">
              <input
                id="email"
                type="email"
                name="email"
                required
                className="user-invalid:border-red-600 min-w-0 grow rounded-md border border-gray-300 bg-white p-2 text-base text-gray-900 placeholder:text-gray-600 hover:border-gray-400 focus:border-transparent focus:outline-2 focus:outline-offset-0 focus:outline-blue-600 disabled:opacity-50 disabled:hover:border-gray-300 sm:text-sm"
              />
            </div>
            <label
              className="text-sm font-medium text-gray-900"
              htmlFor="password"
            >
              Password
            </label>
            <div className="relative flex grow items-center gap-3">
              <input
                id="password"
                type="password"
                name="password"
                required
                className="user-invalid:border-red-600 min-w-0 grow rounded-md border border-gray-300 bg-white p-2 text-base text-gray-900 placeholder:text-gray-600 hover:border-gray-400 focus:border-transparent focus:outline-2 focus:outline-offset-0 focus:outline-blue-600 disabled:opacity-50 disabled:hover:border-gray-300 sm:text-sm"
              />
            </div>
            <div className="pt-5">
              <Button type="submit">Log In</Button>
            </div>
          </ActionForm>
        </div>
      </div>
    </Article>
  );
}
