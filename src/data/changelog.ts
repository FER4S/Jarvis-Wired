/**
 * Release notes, as the app displays them.
 *
 * MIRRORED IN `CHANGELOG.md` at the repo root — update both. This is a plain TS
 * module rather than something generated from the markdown on purpose: the
 * renderer is a Vite bundle, and adding a build step to parse markdown would
 * put weight on the most fragile part of this project (the packaging pipeline)
 * for no user-visible gain.
 *
 * Write for the boss, not for us: what changed for him, no jargon, no version
 * numbers of models, no file paths. Internal changes go in CHANGELOG.md only.
 */

export interface ReleaseNote {
  version: string
  date: string
  headline: string
  items: { title: string; body: string }[]
}

export const CHANGELOG: ReleaseNote[] = [
  {
    version: '1.1.0',
    date: '2026-07-19',
    headline: 'Type to Jarvis, mute him, and fix what he remembers.',
    items: [
      {
        title: 'You can type to Jarvis now',
        body:
          "There's a message box under the conversation. Type anything and press Enter — Jarvis answers exactly as if you'd said it out loud. It works any time, even while he's listening, thinking or talking; typing cuts him off and your message goes first. You can answer his questions by typing too, so you can send a whole email without saying a word."
      },
      {
        title: 'You can mute him',
        body:
          "There's a speaker button next to the message box. Turn it off and Jarvis stops talking out loud — you'll still see everything he says in the conversation. He remembers your choice."
      },
      {
        title: 'You can interrupt him',
        body:
          'If Jarvis is halfway through something you did not want, just say "Hey Jarvis" and he stops talking and listens. No more waiting for a long wrong answer to finish.'
      },
      {
        title: 'Sending email is much harder to derail',
        body:
          'Before, one misheard word — usually which account to send from — threw away the whole message and you started over. Now he asks again instead of giving up. You can also say the whole thing at once: "email Michael and tell him the meeting moved to Thursday" — he works out the rest.'
      },
      {
        title: 'He hears you much better',
        body:
          'Jarvis now uses a considerably more accurate speech model. Names, email addresses and account names come through right far more often.'
      },
      {
        title: 'Emails you send actually show up in Sent',
        body:
          'Messages sent through your Hostinger account now appear in your Sent folder like any other email, so there is a record of them in your mail app.'
      },
      {
        title: 'You can see and edit everything Jarvis remembers',
        body:
          'There is a new Account section where you can read, correct, add or delete anything he has learned about you — your details, the people you work with, facts and dates. You can also paste in a list of contacts and he will sort it into proper entries for you to review before anything is saved.'
      }
    ]
  }
]

export const LATEST: ReleaseNote = CHANGELOG[0]
