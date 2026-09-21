import Link from "next/link";
import { LegalColumn, Clause } from "@/components/legal";

const EMAIL = "hello@juliangigola.com";

export function PrivacyColumn() {
  return (
    <LegalColumn
      id="privacy"
      title="Privacy Policy"
      label="Privacy"
      effective="2026-09-13"
      intro={
        <>
          <p>
            This site collects almost nothing. There are no advertising
            trackers, no third-party cookies, no consent banner because there is
            nothing to consent to, and the only personal information it asks for
            is what you type into the enquiry form so that I can answer you.
            This policy says exactly what is collected, why, who sees it, and
            how long it is kept, and it tells you your rights.
          </p>
          <p className="mt-4 text-muted-foreground">
            The site is juliangigola.com (the &ldquo;Site&rdquo;). The person
            responsible for your information (the &ldquo;controller&rdquo;, in
            the language of European law, and the &ldquo;business&rdquo; in the
            language of California law) is Julian Gigola, a photographer and
            creative director in the San Francisco Bay Area, California,
            reachable at {EMAIL}.
          </p>
        </>
      }
    >
      <Clause title="What is collected, and when">
        <p>
          <strong>If you send an enquiry.</strong> The form collects your name,
          your email address, the kind of shoot you are asking about, the
          optional detail line (a publication, a release date, a location), and
          your message. When it is submitted the Site also records the date and
          time, and the two-letter country code that Cloudflare derives from
          your connection. That is the complete list. The Site does not record
          your IP address with your enquiry.
        </p>
        <p>
          <strong>If you email me directly.</strong> Your email and whatever you
          put in it, handled by Google Workspace, my email provider.
        </p>
        <p>
          <strong>Just by visiting.</strong> Like every website, the Site is
          delivered by servers that see your IP address, browser type, the pages
          requested, and the referring page. The Site runs on Cloudflare, which
          processes that information to deliver pages, to protect the Site from
          abuse, and to produce aggregate analytics (see clause 3). The Site
          itself keeps one derived value: for five minutes after an enquiry is
          sent, it stores a salted one-way hash of the sender&rsquo;s IP
          address, so that the form cannot be submitted again from the same
          connection inside that window. The hash cannot be turned back into the
          address, it is salted with the day so it cannot be matched across
          days, and it deletes itself after five minutes.
        </p>
        <p>
          <strong>Your preferences.</strong> If you switch the site to its light
          theme, that choice is stored in your browser&rsquo;s local storage
          under the key <code>theme</code>. It never leaves your device.
        </p>
        <p>
          <strong>What is not collected.</strong> No account is created, no
          payment details are taken, no location is requested, no fingerprint is
          built, and no information is bought from or matched with third
          parties.
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
            <strong>To keep the Site up, secure, and free of abuse</strong>,
            including the five-minute cooldown and a daily ceiling on enquiries.
            Basis: my legitimate interest in running a working site (Article
            6(1)(f)); the intrusion is minimal and the data is hashed or
            aggregate.
          </li>
          <li>
            <strong>To understand how the Site is used</strong>, in aggregate
            only: how many visits, which pages, from which countries. Basis: the
            same legitimate interest. No individual is identified.
          </li>
          <li>
            <strong>To keep records and meet legal obligations</strong>, such as
            tax and accounting rules for commissioned work. Basis: legal
            obligation (Article 6(1)(c)) and legitimate interest.
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
          shared for anyone else&rsquo;s marketing, and never used to train any
          automated decision-making or profiling system. No decision about you
          is made by automated means.
        </p>
      </Clause>

      <Clause title="Cookies, storage, and analytics">
        <p>
          <strong>The Site sets no cookies of its own.</strong> Cloudflare,
          which delivers the Site, may set strictly necessary cookies for
          security and traffic management; these are essential to delivering the
          Site and need no consent. They contain no information about you beyond
          what is needed to tell one connection from another.
        </p>
        <p>
          <strong>Analytics</strong> are Cloudflare Web Analytics, which is
          designed to work without cookies, without local storage, and without
          fingerprinting. It records that a page was viewed, and aggregate
          technical facts about the visit (country, browser family, referring
          site, load times). It does not identify you, cannot follow you to
          other sites, and is not shared with advertisers.
        </p>
        <p>
          <strong>Local storage</strong> holds your theme choice, as described
          above, and nothing else. On the private editing pages that only I use,
          it also holds my own credentials; those pages do nothing for anyone
          else.
        </p>
        <p>
          <strong>Do Not Track and Global Privacy Control.</strong> The Site
          does no tracking to switch off, so it behaves the same whether or not
          your browser sends these signals. To the extent a signal is treated by
          law as an opt-out of sale or sharing, it is honoured: there is no sale
          or sharing.
        </p>
        <p>
          You can clear local storage and cookies at any time through your
          browser&rsquo;s settings. The Site will keep working.
        </p>
      </Clause>

      <Clause title="Who receives your information">
        <p>
          Nobody receives it for their own purposes. The following providers
          process it on my behalf, under contracts that restrict them to that:
        </p>
        <ul>
          <li>
            <strong>Cloudflare, Inc.</strong> (San Francisco, USA): hosts and
            delivers the Site, stores enquiries in its key-value storage,
            derives the country code, provides the cookieless analytics, and
            sends the email copy of each enquiry to my mailbox. Cloudflare
            operates a global network; your request is handled at the location
            nearest you.
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
          Vimeo and YouTube. Nothing from either is loaded until you press play.
          When you do, your browser connects to their servers and their privacy
          policies apply to that playback. YouTube embeds use the
          youtube-nocookie.com domain, which is YouTube&rsquo;s reduced-tracking
          mode.
        </p>
        <p>
          I may also disclose information if the law requires it, to enforce the
          Terms of Service, or to protect the rights, property, or safety of
          myself, the people in my photographs, or others. If the business is
          ever transferred, your information may pass to the successor under
          this policy.
        </p>
      </Clause>

      <Clause title="International transfers">
        <p>
          I am in the United States and my providers are US companies with
          global infrastructure, so if you are outside the US your information
          is transferred to and processed in the US and wherever those providers
          operate. For visitors in the European Economic Area, the United
          Kingdom, or Switzerland, those transfers rely on the providers&rsquo;
          standard contractual clauses and, where the provider is certified, on
          the EU-US Data Privacy Framework and its UK and Swiss extensions. You
          can ask me for details at {EMAIL}.
        </p>
      </Clause>

      <Clause title="How long it is kept">
        <ul>
          <li>
            <strong>Enquiries</strong> stay in the Site&rsquo;s inbox until I
            have read and answered them, and are then deleted. The email copy in
            my mailbox is kept as long as ordinary business correspondence, and
            longer where it forms part of the record of commissioned work that
            tax and accounting rules require me to keep (generally seven years).
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
            <strong>Analytics</strong> are aggregate from the moment they are
            recorded and hold nothing to delete about an individual.
          </li>
        </ul>
      </Clause>

      <Clause title="Security">
        <p>
          The Site is served only over HTTPS, with strict transport security and
          a content security policy. Enquiries are stored in encrypted storage
          that only the Site&rsquo;s own code and I can read, behind a
          credential that is not shared. The enquiry form has a hidden field
          that catches automated submissions, a per-sender cooldown, and a daily
          ceiling. No system is perfectly secure; if I ever learn of a breach
          affecting your information I will tell you, and any authority the law
          requires, without undue delay.
        </p>
      </Clause>

      <Clause title="Your rights">
        <p>
          Wherever you are, you can ask me what I hold about you, ask me to
          correct it, ask me to delete it, object to my using it, or ask for a
          copy of it in a portable form. Write to {EMAIL}. I will answer within
          thirty days, or within the shorter period your local law sets, and I
          will need enough information to be sure the request comes from you:
          ordinarily, that it comes from the email address the enquiry did.
        </p>
        <p>
          <strong>If you are in the EEA, the UK, or Switzerland</strong>, you
          have the rights of access, rectification, erasure, restriction,
          portability, and objection under the GDPR and its UK equivalent, the
          right to withdraw any consent at any time, and the right to complain
          to your supervisory authority. Where I rely on legitimate interest you
          may object, and I will stop unless there are compelling grounds to
          continue.
        </p>
        <p>
          <strong>If you are in California</strong>, the California Consumer
          Privacy Act gives you the right to know what personal information is
          collected, used, and disclosed; the right to delete it; the right to
          correct it; the right to opt out of its sale or sharing; the right to
          limit the use of sensitive personal information; and the right not to
          be discriminated against for exercising these rights. For the record:
          I collect only the categories described in clause 1 (identifiers and
          the content of your message), I do not sell or share personal
          information and have not done so in the preceding twelve months, I
          collect no sensitive personal information, and I do not use personal
          information for any purpose beyond those in clause 2. You may use an
          authorised agent to make a request; I will ask the agent for proof of
          your authorisation. California&rsquo;s &ldquo;Shine the Light&rdquo;
          law lets you ask which third parties received your personal
          information for their own direct marketing; the answer is none.
        </p>
        <p>
          <strong>If you are elsewhere</strong>, including in another US state
          with a privacy law, the same rights are offered to you as a matter of
          course, and you can exercise them the same way.
        </p>
      </Clause>

      <Clause title="Children">
        <p>
          The Site is not directed to children, and I do not knowingly collect
          personal information from anyone under sixteen. If you believe a child
          has sent an enquiry, write to {EMAIL} and it will be deleted.
        </p>
      </Clause>

      <Clause title="People in the photographs">
        <p>
          The photographs on the Site show people who agreed to be photographed
          for the work in which they appear. If you are one of them and have a
          question about a photograph, or believe one should not be shown, write
          to {EMAIL}. Photographs are never used to identify anyone, are never
          processed by facial recognition, and, as the Terms of Service state,
          may not be used to train any automated system.
        </p>
      </Clause>

      <Clause title="Changes">
        <p>
          When this policy changes, the new version is published here with a new
          effective date. If a change would materially reduce your rights or
          expand what is collected, I will say so on this page in advance and,
          where I have your email address from an open enquiry, tell you
          directly.
        </p>
      </Clause>

      <Clause title="Contact">
        <p>
          Julian Gigola, San Francisco Bay Area, California.{" "}
          <a href={`mailto:${EMAIL}`} className="underline underline-offset-4">
            {EMAIL}
          </a>
          . For anything about your information, put &ldquo;Privacy&rdquo; in
          the subject line and it will be handled first.
        </p>
      </Clause>
    </LegalColumn>
  );
}
