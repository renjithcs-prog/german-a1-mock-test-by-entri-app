export interface TestSubmissionData {
  name: string;
  phone: string;
  language: string;
  readingScore: number;
  listeningScore: number;
  writingScore: number;
  speakingScore: number;
  averageScore: number;
  timestamp: string;
}

/**
 * ============================================================================
 * ⚠️ CRITICAL SETUP INSTRUCTIONS FOR GOOGLE SHEETS ⚠️
 * ============================================================================
 * 
 * IF DATA IS NOT APPEARING IN YOUR SHEET:
 * 
 * 1. Open your Google Sheet > Extensions > Apps Script.
 * 2. Click "Deploy" > "Manage deployments".
 * 3. Click the "Edit" (pencil) icon on your deployment.
 * 4. Check "Who has access". 
 *    👉 IT MUST BE SET TO: "Anyone" 👈
 *    (Not "Anyone with Google Account" or "Only me").
 * 
 * 5. If you change code in the script, you MUST create a NEW Deployment:
 *    Deploy > New deployment > Deploy.
 * 
 * ============================================================================
 */

const getSheetUrl = () => {
  // 1. Try Vite Env Var (Recommended for Vercel)
  // @ts-ignore
  if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_GOOGLE_SHEET_URL) {
    // @ts-ignore
    return import.meta.env.VITE_GOOGLE_SHEET_URL;
  }
  
  // 2. Return hardcoded URL provided by user
  return 'https://script.google.com/macros/s/AKfycbw7wpzYSLRYAsdkI2z7qEl03hyBLiScoUubRCOkqOicE1aNWgDrPxzUpgfST0UIrSYqLg/exec'; 
};

export const submitTestResults = async (data: TestSubmissionData) => {
  const GOOGLE_SCRIPT_URL = getSheetUrl();

  if (!GOOGLE_SCRIPT_URL) {
    console.warn("⚠️ VITE_GOOGLE_SHEET_URL is missing. Data will not be saved to Google Sheets.");
    return;
  }

  try {
    // We utilize URLSearchParams to ensure the data is sent as application/x-www-form-urlencoded.
    // This is the most reliable method to ensure `e.parameter` is populated in Google Apps Script.
    const params = new URLSearchParams();
    params.append('name', data.name);
    params.append('phone', data.phone);
    params.append('language', data.language);
    params.append('readingScore', data.readingScore.toString());
    params.append('listeningScore', data.listeningScore.toString());
    params.append('writingScore', data.writingScore.toString());
    params.append('speakingScore', data.speakingScore.toString());
    params.append('averageScore', data.averageScore.toString());
    params.append('timestamp', data.timestamp);

    // mode: 'no-cors' is mandatory for client-side requests to Google Scripts.
    await fetch(GOOGLE_SCRIPT_URL, {
      method: 'POST',
      mode: 'no-cors',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString()
    });
    
    console.log("✅ Submission sent to Google Sheet (opaque response)");
  } catch (error) {
    console.error("❌ Error submitting to Google Sheets:", error);
  }
};