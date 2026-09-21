import Link from "next/link";
import { LegalColumn, Clause } from "@/components/legal";

const EMAIL = "hello@juliangigola.com";

/* ── the privacy policy ───────────────────────────────────────────
 * The half of this page where being impressive matters less than being
 * true: a terms clause that overreaches is argued about, a privacy claim
 * that overreaches is a misrepresentation. So every statement here was
 * checked against what the Worker actually does.
 *
 * One correction from that check. The policy claimed Cloudflare Web
 * Analytics; there is no beacon on the Site and nothing in the code loads
 * one, so what exists is the aggregate traffic Cloudflare counts from
 * requests it is already handling. The new wording says that, which is
 * both accurate and a stronger position.
 *
 * Clauses are cited by name rather than by number, as in the terms, so
 * inserting one cannot quietly break a reference.
 * ─────────────────────────────────────────────────────────────── */

export function PrivacyColumn() {
  return (
    <LegalColumn
      id="privacy"
      title="Privacy Policy"
      label="Privacy"
      effective="2026-09-21"
      intro={
        <>
          <p>
            This site collects almost nothing. No advertising trackers, no
            third-party cookies, no consent banner because there is nothing to
            consent to. The only personal information it asks for is what you
            type into the enquiry form so that I can answer you.
          </p>
          <p className="mt-4 text-muted-foreground">
            The Site is juliangigola.com. The person responsible for your
            information, the controller in the language of European law and the
            business in the language of California law, is Julian Gigola, a
            photographer and creative director in the San Francisco Bay Area,
            California, reachable at {EMAIL}.
          </p>
        </>
      }
    >
      <Clause title="What is collected, and when">
        <p>
          <strong>If you send an enquiry.</strong> The form collects your name,
          your email address, the kind of shoot you are asking about, the
          optional detail line such as a publication, a release date or a
          location, and your message. On submission the Site also records the
          date and time and the two-letter country code Cloudflare derives from
          your connection. That is the complete list. Your IP address is not
          stored with your enquiry.
        </p>
        <p>
          <strong>If you email me directly.</strong> Your address and whatever
          you put in the message, held in Google Workspace, my email provider.
        </p>
        <p>
          <strong>Just by visiting.</strong> As with every website, the servers
          that deliver the Site see your IP address, your browser type, the
          pages you request and the page you came from. Cloudflare processes
          that to deliver pages and to protect the Site from abuse. The Site
          itself keeps one derived value: for five minutes after an enquiry is
          sent it stores a salted one-way hash of the sender&rsquo;s IP address,
          so the form cannot be fired again from the same connection inside that
          window. The hash cannot be turned back into an address, the salt
          changes daily so it cannot be matched across days, and it deletes
          itself after five minutes.
        </p>
        <p>
          <strong>Your preferences.</strong> Switching the Site to its light
          theme stores that choice in your browser under the key{" "}
          <code>theme</code>. It never leaves your device.
        </p>
        <p>
          <strong>What is not collected.</strong> No account, no payment
          details, no location request, no fingerprint, and nothing bought from
          or matched against a third party.
        </p>
      </Clause>

      <Clause title="Why, and on what legal basis">
        <ul>
          <li>
            <strong>
              To answer you and, if we work together, to do the work.
            </strong>{" "}
            Basis: the steps you have asked me to take before entering a
            contract, and then the contract itself (GDPR Article 6(1)(b)).
          </li>
          <li>
            <strong>To keep the Site up, secure and free of abuse</strong>,
            which is what the five-minute cooldown and the daily ceiling on
            enquiries are for. Basis: my legitimate interest in running a
            working site (Article 6(1)(f)). The intrusion is minimal and the
            data is hashed or aggregate.
          </li>
          <li>
            <strong>To see how the Site is used</strong>, in aggregate only: how
            many visits, which pages, from which countries. Basis: the same
            legitimate interest. Nobody is identified.
          </li>
          <li>
            <strong>To keep records and meet legal obligations</strong>, such as
            the tax and accounting rules that apply to commissioned work. Basis:
            legal obligation (Article 6(1)(c)) and legitimate interest.
          </li>
          <li>
            <strong>To establish, exercise or defend legal claims</strong>,
            including enforcing the{" "}
            <Link href="#terms" className="underline underline-offset-4">
              Terms of Service
            </Link>
            . Basis: legitimate interest.
          </li>
        </ul>
        <p>
          Your information is never used for advertising, never sold, never
          shared for anybody else&rsquo;s marketing, and never used to train any
          automated system. No decision about you is made by automated means,
          and there is no profiling.
        </p>
      </Clause>

      <Clause title="Cookies, storage, and analytics">
        <p>
          <strong>The Site sets no cookies of its own.</strong> Cloudflare,
          which delivers it, may set strictly necessary cookies for security and
          traffic management. Those are essential to delivering the Site and
          need no consent, and they carry nothing about you beyond what is
          needed to tell one connection from another.
        </p>
        <p>
          <strong>There is no analytics script on the Site.</strong> Nothing is
          loaded to measure you: no tag manager, no pixel, no third-party
          beacon. What I see is the aggregate traffic Cloudflare counts from
          requests it is already handling to deliver the pages, such as how many
          requests arrived, for which paths, and from which countries. It is
          aggregate from the moment it is recorded, it does not identify you, it
          cannot follow you to another site, and it goes to no advertiser.
        </p>
        <p>
          <strong>Local storage</strong> holds your theme choice and nothing
          else. On the private editing pages that only I use it also holds my
          own credentials; those pages do nothing for anybody else.
        </p>
        <p>
          <strong>Do Not Track and Global Privacy Control.</strong> There is no
          tracking here to switch off, so the Site behaves the same whether or
          not your browser sends those signals. Where the law treats such a
          signal as an opt-out of sale or sharing, it is honoured: there is no
          sale and no sharing.
        </p>
        <p>
          You can clear local storage and cookies whenever you like. The Site
          will carry on working.
        </p>
      </Clause>

      <Clause title="Who receives your information">
        <p>
          Nobody receives it for their own purposes. These providers process it
          on my behalf, under contracts that hold them to that:
        </p>
        <ul>
          <li>
            <strong>Cloudflare, Inc.</strong> (San Francisco, USA): hosts and
            delivers the Site, stores enquiries in its key-value storage,
            derives the country code, and sends the email copy of each enquiry
            to my mailbox. Cloudflare runs a global network and your request is
            handled at the location nearest you.
          </li>
          <li>
            <strong>Google LLC</strong> (Google Workspace): my email service. A
            copy of each enquiry is delivered to my mailbox there, and any email
            you send me is stored there.
          </li>
          <li>
            <strong>GitHub, Inc.</strong>: hosts the code and the published
            photographs. It receives no visitor information.
          </li>
        </ul>
        <p>
          <strong>Embedded films.</strong> The video page embeds films from
          Vimeo and YouTube. Nothing from either loads until you press play.
          Once you do, your browser connects to their servers and their privacy
          policies govern that playback. YouTube embeds use the
          youtube-nocookie.com domain, which is YouTube&rsquo;s reduced-tracking
          mode.
        </p>
        <p>
          I may also disclose information where the law requires it, where it is
          needed to enforce the Terms of Service, or to protect the rights,
          property or safety of myself, the people in my photographs, or others.
          A demand from a public authority is answered only so far as the law
          obliges me, and I will tell you about it unless I am forbidden to. If
          the business is ever transferred, your information may pass to the
          successor under this policy.
        </p>
      </Clause>

      <Clause title="International transfers">
        <p>
          I am in the United States and my providers are US companies with
          global infrastructure, so if you are outside the US your information
          is transferred to and processed in the US and wherever those providers
          operate. For visitors in the European Economic Area, the United
          Kingdom or Switzerland, those transfers rely on the providers&rsquo;
          standard contractual clauses and, where the provider is certified, on
          the EU-US Data Privacy Framework and its UK and Swiss extensions. Ask
          me at {EMAIL} for the details.
        </p>
        <p>
          I have not appointed a representative in the European Union or the
          United Kingdom. My processing of information about people there is
          occasional, is limited to the categories above, includes no special
          category data, and is unlikely to result in a risk to anybody&rsquo;s
          rights and freedoms, which is the exemption in Article 27(2)(a) of the
          GDPR and its UK equivalent. Write to me directly at {EMAIL}; I answer
          the same requests a representative would take.
        </p>
      </Clause>

      <Clause title="How long it is kept">
        <ul>
          <li>
            <strong>Enquiries</strong> stay in the Site&rsquo;s inbox until I
            have read and answered them, and are then deleted. The email copy in
            my mailbox is kept as long as ordinary business correspondence, and
            longer where it forms part of the record of commissioned work that
            tax and accounting rules oblige me to keep, generally seven years.
          </li>
          <li>
            <strong>The cooldown hash</strong> deletes itself five minutes after
            the enquiry. <strong>The daily enquiry counter</strong>, which holds
            a number and nothing else, deletes itself after two days.
          </li>
          <li>
            <strong>Server logs</strong> are held by Cloudflare for its own
            operational periods, which are short, and are not exported to me.
          </li>
          <li>
            <strong>Aggregate traffic figures</strong> hold nothing about an
            individual to delete.
          </li>
        </ul>
      </Clause>

      <Clause title="Security">
        <p>
          The Site is served only over HTTPS, with strict transport security and
          a content security policy. Enquiries are held in encrypted storage
          that only the Site&rsquo;s own code and I can read, behind a
          credential that is not shared. The form has a hidden field that
          catches automated submissions, a per-sender cooldown, and a daily
          ceiling.
        </p>
        <p>
          No system is perfectly secure, and I do not claim this one is. If I
          learn of a breach affecting your information I will tell you, and any
          authority the law requires, without undue delay.
        </p>
      </Clause>

      <Clause title="Your rights">
        <p>
          Wherever you are, you can ask me what I hold about you, ask me to
          correct it, ask me to delete it, object to my using it, or ask for a
          copy in a portable form. Write to {EMAIL}. I answer within thirty
          days, or within the shorter period your local law sets, and I will
          need enough to be sure the request comes from you: ordinarily, that it
          comes from the address the enquiry came from.
        </p>
        <p>
          <strong>If you are in the EEA, the UK or Switzerland</strong>, you
          have the rights of access, rectification, erasure, restriction,
          portability and objection under the GDPR and its UK equivalent, the
          right to withdraw consent at any time, and the right to complain to
          your supervisory authority. Where I rely on legitimate interest you
          may object, and I will stop unless there are compelling grounds to
          carry on.
        </p>
        <p>
          <strong>If you are in California</strong>, the California Consumer
          Privacy Act gives you the right to know what personal information is
          collected, used and disclosed; to delete it; to correct it; to opt out
          of its sale or sharing; to limit the use of sensitive personal
          information; and not to be discriminated against for exercising any of
          them. For the record: I collect only the categories set out in{" "}
          <em>What is collected, and when</em>, which are identifiers and the
          content of your message; I do not sell or share personal information
          and have not done so in the preceding twelve months; I collect no
          sensitive personal information; and I use nothing beyond the purposes
          in <em>Why, and on what legal basis</em>. You may use an authorised
          agent, and I will ask that agent to prove your authorisation.
          California&rsquo;s Shine the Light law lets you ask which third
          parties received your personal information for their own direct
          marketing: the answer is none.
        </p>
        <p>
          <strong>If you are elsewhere</strong>, including in another US state
          with a privacy law of its own, you are offered the same rights as a
          matter of course and exercise them the same way.
        </p>
      </Clause>

      <Clause title="Children">
        <p>
          The Site is not directed to children and I do not knowingly collect
          personal information from anybody under sixteen, which covers the
          thirteen-year threshold that United States law sets as well. If you
          believe a child has sent an enquiry, write to {EMAIL} and it will be
          deleted.
        </p>
      </Clause>

      <Clause title="People in the photographs">
        <p>
          The photographs show people who agreed to be photographed for the work
          they appear in. If you are one of them and have a question about a
          photograph, or believe one should not be shown, write to {EMAIL} and
          say which one. Photographs are never used to identify anybody, are
          never put through facial recognition, and, as the Terms of Service
          say, may not be used to train any automated system.
        </p>
      </Clause>

      <Clause title="Changes">
        <p>
          When this policy changes, the new version is published here with a new
          effective date. If a change would materially reduce your rights or
          widen what is collected, I will say so on this page in advance and,
          where I have your address from an open enquiry, tell you directly.
        </p>
      </Clause>

      <Clause title="Contact">
        <p>
          Julian Gigola, San Francisco Bay Area, California.{" "}
          <a href={`mailto:${EMAIL}`} className="underline underline-offset-4">
            {EMAIL}
          </a>
          . For anything about your information, put Privacy in the subject line
          and it goes to the top of the pile.
        </p>
      </Clause>
    </LegalColumn>
  );
}
