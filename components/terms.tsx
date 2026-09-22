import Link from "next/link";
import { LegalColumn, Clause } from "@/components/legal";

const SITE = "juliangigola.com";
const EMAIL = "hello@juliangigola.com";

/* ── the terms ────────────────────────────────────────────────────
 * Julian: it must not read as though a machine wrote it, it must look
 * like a real instrument, and it must cover him.
 *
 * Three things follow from that. Clauses are cited by name and never by
 * number, so a clause can be added without silently breaking a
 * cross-reference somewhere else in the document. Definitions are a
 * clause of their own rather than a paragraph of preamble, which is where
 * an agreement puts them. And the enumerations stay: a list of eleven
 * near-synonyms is not padding in a contract, it is the part that closes
 * the gap somebody will otherwise walk through.
 *
 * What was thinned is the explaining. Prose that told the reader what the
 * document was about to do, and tidy parallel triads, are the register
 * that reads as generated; the obligations themselves are untouched
 * except where they were loose.
 * ─────────────────────────────────────────────────────────────── */

export function TermsColumn() {
  return (
    <LegalColumn
      id="terms"
      title="Terms of Service"
      label="Terms"
      effective="2026-09-21"
    >
      <Clause title="Definitions">
        <p>
          <strong>&ldquo;I&rdquo;, &ldquo;me&rdquo; and &ldquo;my&rdquo;</strong>{" "}
          mean Julian Gigola, a sole proprietor in the San Francisco Bay Area,
          California, who owns and operates {SITE}.
        </p>
        <p>
          <strong>&ldquo;The Site&rdquo;</strong> means {SITE}, every page and
          subdomain of it, every file served from it, and the feeds, headers and
          metadata it publishes.
        </p>
        <p>
          <strong>&ldquo;Content&rdquo;</strong> means everything on the Site:
          photographs, films, stills, frames, covers, thumbnails, placeholders,
          previews, captions, text, layout, code, and graphics, together with
          the selection and arrangement of them.
        </p>
        <p>
          <strong>&ldquo;You&rdquo;</strong> means whoever accesses the Site,
          whether a person, a company, or software acting for either. If you
          access it for an organisation, you confirm you have authority to bind
          it, and &ldquo;you&rdquo; means that organisation as well.
        </p>
        <p>
          The{" "}
          <Link href="#privacy" className="underline underline-offset-4">
            Privacy Policy
          </Link>{" "}
          is part of these terms.
        </p>
      </Clause>

      <Clause title="Agreement">
        <p>
          Accessing the Site is acceptance of these terms. That is true however
          you reach it: a browser, a script, a crawler, an API client, a proxy,
          a cache, an archive, a model, or an agent. If you do not accept them,
          do not access the Site.
        </p>
        <p>
          A program that requests a page has accepted these terms on behalf of
          whoever runs it, and that person or organisation is bound by them. No
          human needs to have read this page for the agreement to bind.
        </p>
      </Clause>

      <Clause title="Ownership">
        <p>
          The Content is protected by copyright and, where it applies, by other
          intellectual property and personality rights. I own it or hold a
          licence to it from the people it was made for. All rights are
          reserved. Nothing on the Site transfers any right, title or interest
          to you, and no licence arises by implication, estoppel, course of
          dealing, or otherwise, apart from the narrow one in{" "}
          <em>What you may do</em>.
        </p>
        <p>
          Many of the photographs show identifiable people, brands and products.
          The releases behind them cover the work as I published it here and
          nothing else. Taking a photograph of a person from this Site and using
          it elsewhere is likely to infringe that person&rsquo;s rights as well
          as mine, and I will treat it as both.
        </p>
        <p>
          My name and the marks and logos on the Site are mine or belong to the
          clients they name. Do not use any of them without written permission,
          including in metadata, in a domain, or as a keyword.
        </p>
      </Clause>

      <Clause title="What you may do">
        <p>
          You may look at the Site in a web browser, for your own reference or
          to decide whether to commission or license my work. Your browser may
          cache what it needs to show a page. You may link to any page, and you
          may share that link.
        </p>
        <p>That is the whole of the licence, and it is revocable at any time.</p>
      </Clause>

      <Clause title="What you may not do">
        <p>
          Without my prior written permission you may not do any of the
          following, and may not help, pay, instruct or permit anyone else to:
        </p>
        <ul>
          <li>
            copy, download, save, screenshot, screen-record, print, extract, or
            otherwise reproduce any Content, in whole or in part, in any medium,
            beyond the transient copies a browser makes to display a page;
          </li>
          <li>
            publish, post, upload, distribute, transmit, broadcast, display,
            perform, sell, license, or otherwise make any Content available to
            anyone else, on any platform, in any form;
          </li>
          <li>
            modify, crop, recolour, retouch, composite, translate, or make any
            derivative work from any Content;
          </li>
          <li>
            embed, hotlink, frame, mirror, or inline any part of the Site or any
            file served from it on another site, app, or service;
          </li>
          <li>
            remove, alter, or obscure any copyright notice, watermark, credit,
            metadata, or rights-management information, or use any Content from
            which such information has been removed;
          </li>
          <li>
            use any Content for any commercial purpose, including advertising,
            marketing, merchandise, stock, editorial use, mood boards or pitch
            decks shown to clients, or as a reference for work commissioned from
            somebody else;
          </li>
          <li>
            access the Site by automated means, including crawlers, spiders,
            scrapers, bots, headless browsers, download managers and scripts,
            except a search engine indexing the Site in accordance with my
            robots.txt for the sole purpose of returning links to it in search
            results;
          </li>
          <li>
            circumvent, disable, or interfere with any technical measure on the
            Site, including rate limits, access controls, robots directives,
            rights-reservation headers, and the notice that appears when a
            photograph is right-clicked;
          </li>
          <li>
            use the Site or any Content to identify, locate, profile, or contact
            the people shown in the photographs;
          </li>
          <li>
            attempt to gain access to any private area, account, or system
            behind the Site, or probe it for vulnerabilities;
          </li>
          <li>
            use the Site in any way that is unlawful, that infringes anyone
            else&rsquo;s rights, or that could damage, overload, or impair the
            Site or the services it runs on.
          </li>
        </ul>
        <p>
          That list is not exhaustive. Anything the licence in{" "}
          <em>What you may do</em> does not expressly permit is prohibited.
        </p>
      </Clause>

      <Clause title="No use for AI or machine learning">
        <p>
          <strong>
            Nothing on this Site may be used to train, fine-tune, test,
            evaluate, benchmark, align, prompt, ground, or otherwise develop or
            operate any artificial intelligence or machine learning system.
          </strong>{" "}
          This applies to every kind of system, including image generators,
          image-to-image and video models, multimodal and language models,
          classifiers, embedding and retrieval systems, recommendation systems
          and style-transfer tools, and to every stage of their life:
          collecting, crawling, scraping, downloading, copying, mirroring,
          caching, labelling, annotating, captioning, embedding, vectorising,
          indexing, tokenising, compiling into a dataset or corpus, using as a
          reference image, or generating output that imitates, reproduces, or is
          derived from the Content or my style.
        </p>
        <p>Without limiting that, you may not:</p>
        <ul>
          <li>
            include any Content, any file derived from it, or any description or
            caption of it, in any dataset, corpus, index, or collection used to
            develop or operate any such system, whether public, private,
            commercial, or academic;
          </li>
          <li>
            use any Content as input, context, reference, seed, conditioning, or
            example to any such system, including for image prompting, style
            matching, or generating work in the manner of the Content;
          </li>
          <li>
            use any output of any such system that was produced with the help of
            the Content;
          </li>
          <li>
            access the Site with any agent, browser, or tool that will do any of
            the above as a consequence of accessing it.
          </li>
        </ul>
        <p>
          <strong>Reservation of rights.</strong> To the fullest extent
          permitted by law, I expressly reserve all rights in the Content for
          the purposes of text and data mining, machine learning, and artificial
          intelligence, and I opt out of and object to every exception,
          limitation, or licence that would otherwise permit those uses. This is
          an express reservation for the purposes of Article 4(3) of Directive
          (EU) 2019/790 and its implementations in the member states, of the
          corresponding provisions of United Kingdom law, and of any equivalent
          provision anywhere else. The reservation is repeated in
          machine-readable form on every response from the Site (the{" "}
          <code>TDM-Reservation</code>, <code>TDM-Policy</code> and{" "}
          <code>X-Robots-Tag</code> headers), in{" "}
          <code>/.well-known/tdmrep.json</code>, and in <code>/robots.txt</code>
          . A crawler that ignores those signals is in breach of these terms
          from its first request, and cannot claim it was not on notice.
        </p>
        <p>
          <strong>Existing copies.</strong> If any Content is already in a
          dataset, index, or model, whether you put it there or acquired it from
          somebody who did, you must delete it, must stop using the affected
          dataset and any model trained on it, and must tell me at {EMAIL}.
          Nothing in this clause ratifies a past use or waives a claim for it.
        </p>
        <p>
          <strong>No implied licence.</strong> The absence of a technical
          barrier is not permission. That a file can be fetched, that a page
          renders in a headless browser, or that an opt-out form exists on
          somebody else&rsquo;s platform, gives you no right to use the Content
          for these purposes.
        </p>
      </Clause>

      <Clause title="Unauthorised use, and what it costs">
        <p>
          If you use the Content without permission, you owe me a fee for that
          use. It is the greater of three times my standard licence fee for the
          use actually made, and my then-current minimum licence fee, calculated
          per work, per use and per territory, together with my costs of
          detection and enforcement. That is a genuine pre-estimate of the
          damage: unauthorised use destroys the exclusivity a licence is sold
          on, devalues the work for the client it was made for, and takes time
          to find and stop. It is not a penalty, and it is not a price list for
          buying permission after the fact.
        </p>
        <p>
          Paying it does not make the use lawful, does not grant a licence, and
          does not stop me electing instead to pursue any other remedy, whether
          statutory damages, an account of profits, or an injunction. Where the
          law gives me a larger remedy than this clause, I may take it.
        </p>
        <p>
          <strong>Credit is not a licence.</strong> Attribution, a tag, or a
          link back does not authorise a use and does not reduce the fee.
        </p>
      </Clause>

      <Clause title="Licensing and commissions">
        <p>
          I license my work and I take commissions. If you want to use a
          photograph, or want photographs made, write to {EMAIL} or use the{" "}
          <Link href="/contact" className="underline underline-offset-4">
            contact page
          </Link>
          .
        </p>
        <p>
          A licence exists only once I have confirmed it in writing and its
          scope has been agreed: the use, the media, the territory, the
          duration, and the fee. Rates shown or described anywhere on the Site
          are indicative, are not an offer, and do not survive a change of
          brief. Nothing on the Site, and no email exchange short of my express
          written confirmation, creates a contract for licensing or for
          services.
        </p>
        <p>
          Where a separate written agreement between us exists, whether a
          licence, an estimate, a booking confirmation, or a contract for
          services, that agreement governs the work it describes and prevails
          over these terms to the extent the two conflict.
        </p>
      </Clause>

      <Clause title="Enquiries and material you send">
        <p>
          When you send an enquiry you confirm that what you have written is
          accurate and that you are entitled to send it. You give me the right
          to use it to answer you, to evaluate and carry out the work discussed,
          and to keep a record of it. Where it goes and how long it is kept is
          in the{" "}
          <Link href="#privacy" className="underline underline-offset-4">
            Privacy Policy
          </Link>
          .
        </p>
        <p>
          Do not send anything confidential, anything you have no right to send,
          or anything unlawful. An enquiry is not a confidential communication
          and no non-disclosure obligation arises from sending one. If you send
          an idea, a brief, or a reference, I am free to work on similar
          projects for other people; I take no obligation from having read it.
        </p>
        <p>
          The form is protected against automated submission. Using it to send
          spam, to probe the Site, or to send anything other than a genuine
          enquiry is a breach of these terms.
        </p>
      </Clause>

      <Clause title="Third-party services and links">
        <p>
          Films on the Site are embedded from Vimeo and YouTube. Nothing from
          either loads until you press play; once you do, their services, terms
          and privacy policies govern that playback and I have no control over
          them. The Site links to Instagram, Vimeo and LinkedIn, and may link
          elsewhere. I am not responsible for any third-party site or service,
          and a link is not an endorsement.
        </p>
      </Clause>

      <Clause title="Copyright notices and takedown">
        <p>
          If you believe Content on the Site infringes your rights, write to{" "}
          {EMAIL} with your name and contact details, identification of the work
          you say is infringed, the address of the page on this Site, a
          statement of your good faith belief that the use is not authorised, a
          statement under penalty of perjury that your notice is accurate and
          that you are the owner or are authorised to act for the owner, and
          your physical or electronic signature. Notices that meet 17 U.S.C.
          &sect;512(c)(3), and the equivalent requirements elsewhere, are acted
          on promptly. Knowingly sending a false notice carries liability under
          17 U.S.C. &sect;512(f).
        </p>
        <p>
          If you find my work somewhere it should not be, tell me at the same
          address.
        </p>
      </Clause>

      <Clause title="No warranty">
        <p>
          The Site and the Content are provided as is and as available, without
          warranty of any kind, express or implied, including any warranty of
          merchantability, fitness for a particular purpose, title,
          non-infringement, accuracy, or uninterrupted or error-free operation.
          I may change, suspend, or withdraw any part of the Site at any time
          and without notice, and I do not undertake to keep any page, image, or
          address available. Some jurisdictions do not allow the exclusion of
          implied warranties; there, the exclusion applies as far as the law
          allows.
        </p>
      </Clause>

      <Clause title="Limitation of liability">
        <p>
          To the fullest extent permitted by law, I am not liable to you for any
          indirect, incidental, special, consequential, exemplary, or punitive
          damages, or for any loss of profit, revenue, data, goodwill, or
          opportunity, arising out of or in connection with the Site or these
          terms, however caused and on any theory of liability, even if I had
          been told such loss was possible. My total liability for all claims
          relating to the Site is limited to one hundred US dollars (US$100) or
          the amount you have paid me for the matter in question, whichever is
          greater.
        </p>
        <p>
          These limits are part of the basis of our agreement and apply even if
          a remedy fails of its essential purpose. Nothing in these terms limits
          liability that cannot be limited by law, including for fraud, for
          death or personal injury caused by negligence, or under any
          non-waivable consumer protection statute.
        </p>
      </Clause>

      <Clause title="Indemnity">
        <p>
          You will indemnify me and hold me harmless from every claim, loss,
          liability, damage, cost and expense, including reasonable legal fees,
          arising out of your breach of these terms, your use of any Content
          beyond the licence in <em>What you may do</em>, or your violation of
          any law or of anybody&rsquo;s rights. I may take over the defence of
          any matter covered by this clause, and you will cooperate with it. You
          will not settle anything in a way that admits fault on my part or
          binds me, without my written consent.
        </p>
      </Clause>

      <Clause title="Enforcement">
        <p>
          A breach of <em>What you may not do</em> or of{" "}
          <em>No use for AI or machine learning</em> causes harm that money
          cannot fully repair, so I am entitled to injunctive and other
          equitable relief to prevent or stop it, without posting a bond, in
          addition to every other remedy.
        </p>
        <p>
          Unauthorised use of the Content is also copyright infringement, for
          which the law provides remedies including statutory damages of up to
          US$150,000 per work for wilful infringement. Removing or altering
          rights-management information is separately actionable under 17 U.S.C.
          &sect;1202. I register my work with the United States Copyright
          Office.
        </p>
        <p>
          I may suspend or block any access to the Site at any time, for any
          reason, without notice. If I bring a claim to enforce these terms and
          prevail, you will pay my reasonable legal fees and costs.
        </p>
      </Clause>

      <Clause title="Governing law and disputes">
        <p>
          These terms, and any dispute arising out of or relating to them or to
          the Site, are governed by the laws of the State of California and the
          federal laws of the United States, without regard to conflict of laws
          rules. The United Nations Convention on Contracts for the
          International Sale of Goods does not apply.
        </p>
        <p>
          Before starting proceedings, write to me at {EMAIL} setting out the
          dispute, and we will each make a good-faith attempt to resolve it
          within thirty days. If that fails, the state and federal courts in San
          Francisco County, California have exclusive jurisdiction; you consent
          to their personal jurisdiction and waive any objection to that venue
          on grounds of inconvenience. I may still seek injunctive relief, or
          enforce my intellectual property rights, in any court that has
          jurisdiction over you or your assets.
        </p>
        <p>
          Any claim relating to the Site must be brought within one year of the
          day it arose, or it is barred for good. Claims may be brought only in
          an individual capacity, and not as a plaintiff or class member in any
          purported class, collective, or representative proceeding.
        </p>
      </Clause>

      <Clause title="Age">
        <p>
          The Site is not directed at children. If you are under 13, do not use
          it and do not send an enquiry. If you are between 13 and 18, use it
          only with the involvement of a parent or guardian, who accepts these
          terms on your behalf. If I learn that somebody under 13 has sent me
          personal information, I delete it.
        </p>
      </Clause>

      <Clause title="Accessibility">
        <p>
          I want the Site to be usable by everybody, and I work towards the Web
          Content Accessibility Guidelines 2.2 at level AA. Parts of it are
          photographic and visual by nature, and I cannot promise that every
          element meets every criterion at every moment. If something is in your
          way, write to {EMAIL} and describe it; I will fix what I can and offer
          another way to get the same information in the meantime.
        </p>
      </Clause>

      <Clause title="Changes">
        <p>
          I may change these terms by publishing a new version on this page with
          a new effective date. The version in force is the one published when
          you access the Site. Continuing to use it after a change is acceptance
          of the change. Changes do not apply retroactively to a dispute that
          had already arisen.
        </p>
      </Clause>

      <Clause title="General">
        <p>
          These terms and the Privacy Policy are the entire agreement between
          you and me about the Site, and replace everything said on the subject
          before them. If a provision is held unenforceable, it is to be
          enforced as far as it can be and the rest stands. Not enforcing
          something is not a waiver of it. You may not assign these terms; I may
          assign them to a successor to the Site or to my business. Nothing here
          makes us partners, or makes either of us the agent or employee of the
          other. There is no third-party beneficiary of these terms.
        </p>
        <p>
          <em>Definitions</em>, <em>Ownership</em>,{" "}
          <em>What you may not do</em>,{" "}
          <em>No use for AI or machine learning</em>,{" "}
          <em>Unauthorised use, and what it costs</em>, <em>No warranty</em>,{" "}
          <em>Limitation of liability</em>, <em>Indemnity</em>,{" "}
          <em>Enforcement</em>, <em>Governing law and disputes</em> and this
          clause survive any end to your access. Headings are there to be read
          by. Where these terms are translated, the English version governs.
        </p>
      </Clause>

      <Clause title="Contact">
        <p>
          Julian Gigola, San Francisco Bay Area, California.{" "}
          <a href={`mailto:${EMAIL}`} className="underline underline-offset-4">
            {EMAIL}
          </a>
          .
        </p>
      </Clause>
    </LegalColumn>
  );
}
