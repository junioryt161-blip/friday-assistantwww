import { evaluate } from 'mathjs';
import * as Contacts from 'expo-contacts';
import * as IntentLauncher from 'expo-intent-launcher';
import * as MediaLibrary from 'expo-media-library';
import { Linking } from 'react-native';
import { XMLParser } from 'fast-xml-parser';

export class CommandEngine {
  private static pendingContactList: Contacts.Contact[] | null = null;

  public static async execute(rawText: string, onReply: (msg: string) => void) {
    const text = rawText.trim().toLowerCase();

    // 1. Contact selection followup
    if (this.pendingContactList && this.pendingContactList.length > 0) {
      await this.handleContactSelection(text, onReply);
      return;
    }

    // 2. Math
    if (this.isMathQuery(text)) {
      this.handleMath(text, onReply);
      return;
    }

    // 3. Torch
    if (text.includes('torch on') || text.includes('flashlight on')) {
      onReply("Torch turned on Boss.");
      return;
    }
    if (text.includes('torch off') || text.includes('flashlight off')) {
      onReply("Torch turned off Boss.");
      return;
    }

    // 4. YouTube
    if (text.includes('youtube')) {
      const query = text.replace(/play|on youtube|youtube/gi, '').trim();
      onReply(`Playing ${query} on YouTube Boss.`);
      Linking.openURL(`https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`);
      return;
    }

    // 5. Local Music
    if (text.startsWith('play song') || text.startsWith('play music')) {
      await this.handleMusic(text, onReply);
      return;
    }

    // 6. Calls
    if (text.startsWith('call ')) {
      await this.handleCall(text.replace('call ', '').trim(), onReply);
      return;
    }

    // 7. News
    if (text.includes('news') || text.includes('headlines')) {
      await this.fetchNews(onReply);
      return;
    }

    // 8. Photo & Video Intents
    if (text.includes('take a photo') || text.includes('take photo')) {
      onReply("Opening camera Boss.");
      IntentLauncher.startActivityAsync(IntentLauncher.ActivityAction.IMAGE_CAPTURE);
      return;
    }

    if (text.includes('record video') || text.includes('start video')) {
      onReply("Starting video camera Boss.");
      IntentLauncher.startActivityAsync(IntentLauncher.ActivityAction.VIDEO_CAPTURE);
      return;
    }

    onReply("Sorry Boss, I did not catch that.");
  }

  private static isMathQuery(text: string): boolean {
    return /(times|multiplied|divided|plus|minus|\+|\-|\*|\/|percent of|square root)/i.test(text);
  }

  private static handleMath(text: string, onReply: (msg: string) => void) {
    try {
      let expression = text
        .replace(/times|multiplied by/g, '*')
        .replace(/divided by/g, '/')
        .replace(/plus/g, '+')
        .replace(/minus/g, '-')
        .replace(/square root of (\d+)/g, 'sqrt($1)')
        .replace(/(\d+)\s*percent of\s*(\d+)/g, '($1 / 100) * $2');

      const result = evaluate(expression);
      onReply(`The answer is ${result}`);
    } catch {
      onReply("Boss, I couldn't calculate that.");
    }
  }

  private static async handleCall(target: string, onReply: (msg: string) => void) {
    const { status } = await Contacts.requestPermissionsAsync();
    if (status !== 'granted') {
      onReply("Please grant contacts permission Boss.");
      return;
    }

    if (/^\+?\d+$/.test(target.replace(/\s+/g, ''))) {
      Linking.openURL(`tel:${target}`);
      onReply(`Calling ${target}`);
      return;
    }

    const { data } = await Contacts.getContactsAsync({
      name: target,
      fields: [Contacts.Fields.PhoneNumbers],
    });

    if (data.length === 0) {
      onReply(`No contact found for ${target} Boss.`);
    } else if (data.length === 1) {
      const number = data[0].phoneNumbers?.[0]?.number;
      if (number) {
        Linking.openURL(`tel:${number}`);
        onReply(`Calling ${data[0].name}`);
      }
    } else {
      this.pendingContactList = data.slice(0, 3);
      const names = this.pendingContactList.map(c => c.name).join(', ');
      onReply(`I found these: ${names}. Which one should I call?`);
    }
  }

  private static async handleContactSelection(text: string, onReply: (msg: string) => void) {
    const matches = this.pendingContactList?.filter(c =>
      c.name.toLowerCase().includes(text.toLowerCase())
    );
    this.pendingContactList = null;

    if (matches && matches.length > 0) {
      const number = matches[0].phoneNumbers?.[0]?.number;
      Linking.openURL(`tel:${number}`);
      onReply(`Calling ${matches[0].name}`);
    } else {
      onReply("Call selection cancelled.");
    }
  }

  private static async handleMusic(text: string, onReply: (msg: string) => void) {
    const songQuery = text.replace(/play song|play music/gi, '').trim();
    const media = await MediaLibrary.getAssetsAsync({ mediaType: 'audio', first: 30 });
    const found = media.assets.find(a => a.filename.toLowerCase().includes(songQuery));

    if (found) {
      onReply(`Playing ${found.filename}`);
      Linking.openURL(found.uri);
    } else {
      onReply(`I couldn't find ${songQuery} in phone storage.`);
    }
  }

  private static async fetchNews(onReply: (msg: string) => void) {
    onReply("Fetching top headlines Boss.");
    try {
      const res = await fetch("https://news.google.com/rss?hl=en-IN&gl=IN&ceid=IN:en");
      const xml = await res.text();
      const parser = new XMLParser();
      const jsonObj = parser.parse(xml);
      const items = jsonObj.rss.channel.item.slice(0, 5);

      const headlines = items.map((i: any, idx: number) => `Headline ${idx + 1}: ${i.title}`).join(". ");
      onReply(headlines);
    } catch {
      onReply("Unable to load headlines right now.");
    }
  }
}
