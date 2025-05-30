'use client';

import { Badge } from '@tuturuuu/ui/badge';
import { Button } from '@tuturuuu/ui/button';
import { Card } from '@tuturuuu/ui/card';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@tuturuuu/ui/form';
import { useForm } from '@tuturuuu/ui/hooks/use-form';
import {
  ArrowRight,
  AtSign,
  FileQuestion,
  Headphones,
  Mail,
  MapPin,
  MessageSquare,
  Phone,
  SendHorizontal,
  User,
} from '@tuturuuu/ui/icons';
import { Input } from '@tuturuuu/ui/input';
import { zodResolver } from '@tuturuuu/ui/resolvers';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@tuturuuu/ui/select';
import { Separator } from '@tuturuuu/ui/separator';
import { Textarea } from '@tuturuuu/ui/textarea';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { useState } from 'react';
import * as z from 'zod';

// Form validation schema
const contactFormSchema = z.object({
  name: z.string().min(2, { message: 'Name must be at least 2 characters.' }),
  email: z.string().email({ message: 'Please enter a valid email address.' }),
  subject: z.string().min(1, { message: 'Please select a subject.' }),
  message: z
    .string()
    .min(10, { message: 'Message must be at least 10 characters.' }),
});

export default function ContactPage() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const form = useForm<z.infer<typeof contactFormSchema>>({
    resolver: zodResolver(contactFormSchema),
    defaultValues: {
      name: '',
      email: '',
      subject: '',
      message: '',
    },
  });

  // Contact form submission handler
  function onSubmit(data: z.infer<typeof contactFormSchema>) {
    setIsSubmitting(true);

    // Simulate API call
    setTimeout(() => {
      console.log('Form submitted:', data);
      setIsSubmitting(false);
      setIsSubmitted(true);
    }, 1500);
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-16 sm:py-24">
      <div className="mb-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-8 text-center"
        >
          <Badge variant="outline" className="mb-4">
            <MessageSquare className="mr-2 h-4 w-4" />
            Get in Touch
          </Badge>
          <h1 className="mb-4 text-4xl font-bold tracking-tight sm:text-5xl">
            Contact Us
          </h1>
          <p className="text-muted-foreground mx-auto max-w-2xl text-lg">
            Have questions or need support? We're here to help. Reach out to our
            team and we'll get back to you as soon as possible.
          </p>
        </motion.div>
      </div>

      <div className="grid gap-8 md:grid-cols-3">
        {/* Contact Information */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
          className="md:col-span-1"
        >
          <div className="space-y-6">
            <Card className="overflow-hidden p-6">
              <h2 className="mb-4 text-xl font-bold">Contact Information</h2>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="text-primary mt-0.5 rounded-full">
                    <Mail className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-medium">Email</p>
                    <p className="text-muted-foreground">support@upskii.com</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="text-primary mt-0.5 rounded-full">
                    <Phone className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-medium">Phone</p>
                    <p className="text-muted-foreground">+1 (123) 456-7890</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="text-primary mt-0.5 rounded-full">
                    <MapPin className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-medium">Address</p>
                    <p>Physical office coming soon</p>
                    {/* <p className="text-muted-foreground">
                      123 Education Street
                      <br />
                      San Francisco, CA 94103
                      <br />
                      United States
                    </p> */}
                  </div>
                </div>
              </div>

              <Separator className="my-6" />

              <h3 className="mb-4 text-lg font-semibold">Support Hours</h3>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span>Monday - Friday</span>
                  <span>9:00 AM - 6:00 PM EST</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Saturday</span>
                  <span>10:00 AM - 4:00 PM EST</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Sunday</span>
                  <span>Closed</span>
                </div>
              </div>
            </Card>

            <Card className="bg-primary/5 overflow-hidden p-6">
              <h3 className="mb-4 text-lg font-semibold">Quick Links</h3>
              <div className="grid grid-cols-1 gap-2">
                <Link href="/faq">
                  <Button variant="outline" className="w-full justify-start">
                    <FileQuestion className="mr-2 h-4 w-4" />
                    FAQ
                    <ArrowRight className="ml-auto h-4 w-4" />
                  </Button>
                </Link>
                <Link href="/guide">
                  <Button variant="outline" className="w-full justify-start">
                    <Headphones className="mr-2 h-4 w-4" />
                    Platform Guide
                    <ArrowRight className="ml-auto h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </Card>
          </div>
        </motion.div>

        {/* Contact Form */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="md:col-span-2"
        >
          <Card className="p-6 md:p-8">
            {isSubmitted ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="bg-primary/10 text-primary mb-4 rounded-full p-3">
                  <SendHorizontal className="h-8 w-8" />
                </div>
                <h2 className="mb-2 text-2xl font-bold">Message Sent!</h2>
                <p className="text-muted-foreground mb-6 max-w-md">
                  Thank you for contacting us. We've received your message and
                  will get back to you shortly.
                </p>
                <Button onClick={() => setIsSubmitted(false)}>
                  Send Another Message
                </Button>
              </div>
            ) : (
              <>
                <h2 className="mb-6 text-xl font-bold">Send Us a Message</h2>
                <Form {...form}>
                  <form
                    onSubmit={form.handleSubmit(onSubmit)}
                    className="space-y-6"
                  >
                    <div className="grid gap-6 md:grid-cols-2">
                      <FormField
                        control={form.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Name</FormLabel>
                            <FormControl>
                              <div className="relative">
                                <User className="text-muted-foreground absolute left-3 top-2.5 h-4 w-4" />
                                <Input
                                  placeholder="Your name"
                                  className="pl-10"
                                  {...field}
                                />
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Email</FormLabel>
                            <FormControl>
                              <div className="relative">
                                <AtSign className="text-muted-foreground absolute left-3 top-2.5 h-4 w-4" />
                                <Input
                                  placeholder="your.email@example.com"
                                  className="pl-10"
                                  {...field}
                                />
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={form.control}
                      name="subject"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Subject</FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select a subject" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="general_inquiry">
                                General Inquiry
                              </SelectItem>
                              <SelectItem value="technical_support">
                                Technical Support
                              </SelectItem>
                              <SelectItem value="billing">
                                Billing & Payments
                              </SelectItem>
                              <SelectItem value="teacher_verification">
                                Teacher Verification
                              </SelectItem>
                              <SelectItem value="course_issue">
                                Course Issue
                              </SelectItem>
                              <SelectItem value="partnership">
                                Partnership Opportunity
                              </SelectItem>
                              <SelectItem value="feedback">
                                Feedback & Suggestions
                              </SelectItem>
                            </SelectContent>
                          </Select>
                          <FormDescription>
                            Select the topic that best describes your inquiry.
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="message"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Message</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Please describe your question or issue in detail..."
                              className="min-h-32"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <Button
                      type="submit"
                      size="lg"
                      className="w-full"
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? (
                        <>Sending Message...</>
                      ) : (
                        <>
                          Send Message
                          <SendHorizontal className="ml-2 h-4 w-4" />
                        </>
                      )}
                    </Button>
                  </form>
                </Form>
              </>
            )}
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
