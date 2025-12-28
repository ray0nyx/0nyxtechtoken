import { NextResponse } from 'next/server';
import axios from 'axios';

const YAHOO_FINANCE_API_KEY = process.env.YAHOO_FINANCE_API_KEY;
const YAHOO_FINANCE_API_HOST = 'yahoo-finance15.p.rapidapi.com';

export async function GET() {
  try {
    console.log('Fetching market news...');
    const response = await axios.get('https://yahoo-finance15.p.rapidapi.com/api/yahoo/ne/news', {
      headers: {
        'X-RapidAPI-Key': YAHOO_FINANCE_API_KEY,
        'X-RapidAPI-Host': YAHOO_FINANCE_API_HOST,
      }
    });

    console.log('Raw API response:', response.data);

    if (!response.data || !Array.isArray(response.data.body)) {
      console.error('Invalid response format:', response.data);
      return NextResponse.json(
        { error: 'Invalid response format from Yahoo Finance API' },
        { status: 500 }
      );
    }

    // Transform the data to match our NewsEvent interface
    const transformedNews = response.data.body.slice(0, 10).map((item: any) => ({
      uuid: item.uuid || Math.random().toString(36).substr(2, 9),
      title: item.title,
      published_at: item.pubDate || new Date().toISOString(),
      publisher: item.source || 'Yahoo Finance',
      summary: item.description || item.summary,
      link: item.link,
      sentiment: analyzeSentiment(item.title + ' ' + (item.description || item.summary || '')),
      categories: determineCategories(item.title + ' ' + (item.description || item.summary || ''))
    }));

    console.log('Transformed news:', transformedNews);

    return NextResponse.json(transformedNews);
  } catch (error: any) {
    console.error('Error fetching market news:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status
    });
    
    return NextResponse.json(
      { error: 'Failed to fetch market news: ' + error.message },
      { status: error.response?.status || 500 }
    );
  }
}

// Simple sentiment analysis based on keywords
function analyzeSentiment(text: string): string {
  const positiveWords = ['surge', 'gain', 'rise', 'jump', 'boost', 'positive', 'rally', 'recover', 'growth', 'bullish', 'higher', 'up'];
  const negativeWords = ['fall', 'drop', 'decline', 'slip', 'tumble', 'negative', 'bearish', 'crash', 'plunge', 'risk', 'down', 'lower'];
  
  text = text.toLowerCase();
  let positiveCount = positiveWords.filter(word => text.includes(word)).length;
  let negativeCount = negativeWords.filter(word => text.includes(word)).length;
  
  if (positiveCount > negativeCount) return 'positive';
  if (negativeCount > positiveCount) return 'negative';
  return 'neutral';
}

// Determine news categories based on keywords
function determineCategories(text: string): string[] {
  text = text.toLowerCase();
  const categories = [];
  
  const categoryKeywords = {
    stocks: ['stocks', 'equity', 'shares', 'market', 'index', 's&p', 'dow', 'nasdaq', 'trading'],
    bonds: ['bonds', 'treasury', 'yield', 'fixed income', 'debt', 'interest rate'],
    forex: ['forex', 'currency', 'dollar', 'euro', 'yen', 'exchange rate', 'gbp', 'usd'],
    commodities: ['gold', 'oil', 'commodity', 'metals', 'crude', 'silver', 'copper']
  };
  
  for (const [category, keywords] of Object.entries(categoryKeywords)) {
    if (keywords.some(keyword => text.includes(keyword))) {
      categories.push(category);
    }
  }
  
  return categories.length > 0 ? categories : ['general'];
} 