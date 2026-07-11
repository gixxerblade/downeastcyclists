'use client';

import {zodResolver} from '@hookform/resolvers/zod';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {useForm, SubmitHandler} from 'react-hook-form';
import {z} from 'zod';

type FormInputs = {
  name: string;
  email: string;
  subject: string;
  message: string;
};

const schema = z.object({
  name: z.string().min(1, {message: 'Name is required'}),
  email: z.string().email({message: 'Invalid email address'}),
  subject: z.string().min(1, {message: 'Subject is required'}),
  message: z.string().min(1, {message: 'Message is required'}),
});

export default function Contact() {
  const router = useRouter();
  const {
    register,
    handleSubmit,
    formState: {errors, isSubmitting},
  } = useForm<FormInputs>({
    resolver: zodResolver(schema),
    mode: 'onChange',
    reValidateMode: 'onChange',
  });

  const onSubmit: SubmitHandler<FormInputs> = async (data) => {
    try {
      const formData = new FormData();
      formData.append('form-name', 'contact');
      formData.append('bot-field', '');
      Object.entries(data).forEach(([key, value]) => formData.append(key, value));

      const response = await fetch('/__forms.html', {
        method: 'POST',
        headers: {'Content-Type': 'application/x-www-form-urlencoded'},
        body: new URLSearchParams(formData as any).toString(),
      });

      if (response.ok) {
        router.push('/thanks');
      } else {
        console.error('Form submission error:', await response.text());
        router.push('/thanks?error=true');
      }
    } catch (error) {
      console.error('Form submission error:', error);
      router.push('/thanks?error=true');
    }
  };

  const inputClass =
    'mt-2 min-h-[52px] w-full rounded-xl border bg-[var(--dec-bg)] px-4 text-[var(--dec-ink)] outline-none transition focus:border-[#F20E02]';

  return (
    <main className="dec-page">
      <section className="dec-container grid gap-10 py-16 md:grid-cols-[1.2fr_.8fr] md:py-20">
        <div>
          <div className="mb-4 text-sm font-bold tracking-[.1em] text-[#F20E02]">CONTACT</div>
          <h1 className="dec-display text-6xl md:text-[92px]">Talk to the club</h1>
          <p className="mt-6 max-w-xl text-lg font-light leading-8 text-[var(--dec-muted)]">
            Questions about rides, trails, memberships, or volunteering? Send a note and a club
            volunteer will follow up.
          </p>
        </div>

        <aside className="dec-card p-7">
          <h2 className="font-[Anton] text-3xl">Quick links</h2>
          <div className="mt-5 flex flex-col gap-4 text-sm font-semibold">
            <a href="mailto:info@downeastcyclists.com" className="text-[#F20E02]">
              info@downeastcyclists.com
            </a>
            <a href="https://www.facebook.com/downeastcyclists" target="_blank" rel="noreferrer noopener">
              Facebook ↗
            </a>
            <a href="https://www.instagram.com/downeastcyclists/" target="_blank" rel="noreferrer noopener">
              Instagram ↗
            </a>
            <a href="https://www.meetup.com/down-east-cyclists/events/calendar/" target="_blank" rel="noreferrer noopener">
              Meetup calendar ↗
            </a>
          </div>
          <div className="mt-7 rounded-2xl bg-[#F20E02] p-5 text-white">
            <div className="font-[Anton] text-3xl">First ride is free</div>
            <p className="mt-2 text-sm leading-6 text-white/85">
              Come meet the group before joining. Bring a helmet, lights, and questions.
            </p>
          </div>
        </aside>
      </section>

      <section className="dec-container pb-20">
        <form
          className="dec-card mx-auto max-w-3xl p-6 md:p-9"
          onSubmit={handleSubmit(onSubmit)}
          data-netlify="true"
          name="contact"
          method="POST"
          netlify-honeypot="bot-field"
          data-netlify-recaptcha="true"
        >
          <input type="hidden" name="form-name" value="contact" />
          <p className="hidden">
            <label>
              Don&apos;t fill this out if you&apos;re human: <input name="bot-field" />
            </label>
          </p>

          <div className="grid gap-5 md:grid-cols-2">
            <label className="block text-sm font-bold text-[var(--dec-muted)]" htmlFor="name">
              Name
              <input id="name" placeholder="First and last" className={`${inputClass} border-[var(--dec-border)]`} {...register('name')} />
              {errors.name && <span className="mt-1 block text-sm text-[#F20E02]">{errors.name.message}</span>}
            </label>

            <label className="block text-sm font-bold text-[var(--dec-muted)]" htmlFor="email">
              Email
              <input id="email" type="email" placeholder="you@email.com" className={`${inputClass} border-[var(--dec-border)]`} {...register('email')} />
              {errors.email && <span className="mt-1 block text-sm text-[#F20E02]">{errors.email.message}</span>}
            </label>
          </div>

          <label className="mt-5 block text-sm font-bold text-[var(--dec-muted)]" htmlFor="subject">
            Subject
            <input id="subject" placeholder="How can we help?" className={`${inputClass} border-[var(--dec-border)]`} {...register('subject')} />
            {errors.subject && <span className="mt-1 block text-sm text-[#F20E02]">{errors.subject.message}</span>}
          </label>

          <label className="mt-5 block text-sm font-bold text-[var(--dec-muted)]" htmlFor="message">
            Message
            <textarea id="message" placeholder="Enter your message..." className={`${inputClass} min-h-40 py-4 border-[var(--dec-border)]`} {...register('message')} />
            {errors.message && <span className="mt-1 block text-sm text-[#F20E02]">{errors.message.message}</span>}
          </label>

          <div className="mt-5" data-netlify-recaptcha="true"></div>
          <button type="submit" className="dec-primary-button mt-7 w-full sm:w-auto" disabled={isSubmitting}>
            {isSubmitting ? 'Submitting...' : 'Send message'}
          </button>
          <p className="mt-4 text-sm text-[var(--dec-muted-2)]">
            Already a member? <Link href="/member" className="font-bold text-[#F20E02]">Open your member portal.</Link>
          </p>
        </form>
      </section>
    </main>
  );
}
