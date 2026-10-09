import Link from "next/link";
import { MiniCloud } from "@/components/diffusion/mini-cloud";
import { Story, Step, UseCase, Habit, USE_CASE_ICONS, HABIT_ICONS } from "./blocks";

/** English content of "What is this site for?". Mirror: content.fr.tsx. */
export function WhyContentEn() {
  return (
    <>
      <header className="text-center">
        <MiniCloud className="mb-2" seed={11} />
        <h1 className="text-4xl font-bold">What is this site for?</h1>
        <p className="mx-auto mt-4 max-w-xl text-lg text-ink-dim">
          Passing on confidential information (a password, a code, a document){" "}
          <strong className="text-ink">without it sticking around</strong> in your
          email or your chats afterwards.
        </p>
      </header>

      <div className="mt-14 space-y-14">
        <Story title="The everyday problem">
          <p>
            You text the Wi-Fi code, email a password, send a login over WhatsApp.
            The message is gone, and it{" "}
            <strong className="text-ink">stays there for years</strong>: in the
            history, in backups, on a phone that can be lost, in a mailbox that can
            be hacked.
          </p>
          <p>The day one of those places leaks, your password leaks with it.</p>
        </Story>

        <Story title="What ppush does">
          <p>
            Instead of sending the secret itself, you send{" "}
            <strong className="text-ink">a link that shows it only once</strong>,
            then erases itself. All that is left in the conversation is a dead
            link.
          </p>
          <ol className="grid gap-3 pt-2 sm:grid-cols-3">
            <Step n={1} title="Paste">
              The password, text or file you want to pass on.
            </Step>
            <Step n={2} title="Choose">
              How long the link stays valid and how many times it can be opened.
            </Step>
            <Step n={3} title="Send the link">
              Your recipient opens it, reads it, and the secret is gone.
            </Step>
          </ol>
          <p className="text-sm">
            Nothing to install, no account needed, free. Your recipient only needs
            a web browser.
          </p>
        </Story>

        <Story title="A few examples">
          <div className="grid gap-3 sm:grid-cols-2">
            <UseCase icon={USE_CASE_ICONS.wifi} title="Wi-Fi for your guests">
              The code arrives, then disappears. It doesn’t linger in the family
              group chat.
            </UseCase>
            <UseCase icon={USE_CASE_ICONS.work} title="A new colleague">
              Their first logins, handed over without leaving a copy in the company
              chat.
            </UseCase>
            <UseCase icon={USE_CASE_ICONS.home} title="A holiday rental">
              The key box or gate code, valid until the guests arrive.
            </UseCase>
            <UseCase icon={USE_CASE_ICONS.family} title="Helping someone close">
              Access to a shared account or a subscription code, without typing it
              out in a text message.
            </UseCase>
            <UseCase icon={USE_CASE_ICONS.file} title="A sensitive document">
              An ID or a contract for someone you trust, which won’t stay behind as
              an attachment.
            </UseCase>
            <UseCase icon={USE_CASE_ICONS.support} title="IT support">
              Temporary access for a contractor, which switches itself off.
            </UseCase>
          </div>
        </Story>

        <Story title="Good habits">
          <div className="space-y-3">
            <Habit icon={HABIT_ICONS.once} title="One recipient, one opening">
              By default the link opens only once. If your recipient finds a link
              that was already used, someone else opened it first: change that
              password.
            </Habit>
            <Habit icon={HABIT_ICONS.split} title="For very sensitive things, two paths">
              Add a passphrase in the advanced options and share it another way (in
              person, over the phone). The link alone is then no longer enough.
            </Habit>
            <Habit icon={HABIT_ICONS.short} title="A short lifetime">
              A link that expires in an hour can’t be dug up a month later.
            </Habit>
          </div>
        </Story>

        <div className="flex flex-col items-center gap-4 border-t border-line/40 pt-10 text-center">
          <Link
            href="/"
            className="rounded-xl bg-accent px-6 py-3 font-semibold text-[var(--on-accent)] transition-colors hover:bg-accent-soft"
          >
            Share a secret
          </Link>
          <p className="text-sm text-ink-faint">
            Curious how it’s protected?{" "}
            <Link href="/about" className="text-accent-soft underline-offset-2 hover:underline">
              It’s all explained in About
            </Link>
          </p>
        </div>
      </div>
    </>
  );
}
