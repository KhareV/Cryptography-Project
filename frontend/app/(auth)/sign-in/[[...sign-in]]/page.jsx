import { SignIn } from "@clerk/nextjs";
import Link from "next/link";

export default function SignInPage() {
  return (
    <div className="relative flex min-h-screen w-full items-center justify-center bg-slate-50 overflow-hidden isolate">
      {/* BACKGROUND DECORATION */}
      <div className="absolute -top-[10%] -left-[10%] -z-10 h-[600px] w-[600px] rounded-full bg-indigo-500/10 blur-[100px]" />
      <div className="absolute top-[20%] -right-[10%] -z-10 h-[500px] w-[500px] rounded-full bg-blue-400/10 blur-[100px]" />
      <div className="absolute -bottom-[10%] left-[20%] -z-10 h-[500px] w-[500px] rounded-full bg-purple-500/10 blur-[100px]" />

      <div className="w-full max-w-[420px] px-4">
        {/* CUSTOM HEADER */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 mb-2">
            Welcome back
          </h1>
          <p className="text-slate-500 text-sm">
            Sign in to continue to{" "}
            <span className="font-semibold text-indigo-600">ChatFlow</span>
          </p>
        </div>

        {/* CLERK COMPONENT */}
        <SignIn
          appearance={{
            // FORCE LIGHT THEME
            variables: {
              colorBackground: "#ffffff",
              colorInputBackground: "#ffffff",
              colorText: "#0f172a",
              colorPrimary: "#4f46e5",
            },
            layout: {
              socialButtonsPlacement: "bottom",
              socialButtonsVariant: "blockButton",
            },
            elements: {
              // ROOT & CARD
              rootBox: "w-full",
              card: "w-full !bg-white/80 backdrop-blur-md border border-slate-200/60 rounded-2xl p-8 shadow-xl",

              // HEADER (Hidden to use custom one)
              headerTitle: "hidden",
              headerSubtitle: "hidden",

              // SOCIAL BUTTONS
              socialButtonsBlockButton:
                "w-full !bg-white border border-slate-200 !text-slate-600 hover:!bg-slate-50 transition-all h-11 rounded-xl shadow-sm",
              socialButtonsBlockButtonText: "font-medium text-sm",

              // DIVIDER
              dividerLine: "bg-slate-200 h-[1px]",
              dividerText:
                "text-slate-400 text-xs font-medium uppercase tracking-wider bg-transparent px-2",

              // FORM FIELDS
              formFieldLabel:
                "!text-slate-700 text-sm font-semibold mb-1.5 ml-1",
              formFieldInput:
                "w-full !bg-white border border-slate-200 !text-slate-900 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-sm placeholder:text-slate-400",

              // PRIMARY BUTTON
              formButtonPrimary:
                "!bg-indigo-600 hover:!bg-indigo-700 text-white font-semibold h-11 rounded-xl shadow-md shadow-indigo-500/20 transition-all hover:-translate-y-0.5",

              // FOOTER
              footer: "mt-6",
              footerAction: "text-slate-500 text-sm flex justify-center gap-2",
              footerActionLink:
                "!text-indigo-600 font-semibold hover:!text-indigo-700 hover:underline",
            },
          }}
          redirectUrl="/chat"
          signUpUrl="/sign-up"
        />

        {/* LEGAL LINKS */}
        <div className="mt-8 text-center text-xs text-slate-400">
          <p>
            By continuing, you agree to our{" "}
            <Link href="/terms" className="hover:text-slate-600 underline">
              Terms
            </Link>{" "}
            and{" "}
            <Link href="/privacy" className="hover:text-slate-600 underline">
              Privacy
            </Link>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
