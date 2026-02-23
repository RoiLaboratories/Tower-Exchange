import { supabase } from "./supabase";

export interface ProfileData {
  userId: string;
  profilePictureUrl?: string;
  displayName?: string;
  bio?: string;
}

/**
 * Upload a profile picture to Supabase storage
 * @param file - The image file to upload
 * @param walletAddress - The user's wallet address (used as unique identifier)
 * @returns The public URL of the uploaded image
 */
export const uploadProfilePicture = async (
  file: File,
  walletAddress: string
): Promise<string> => {
  if (!file) {
    throw new Error("No file provided");
  }

  // Validate file type
  const validTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
  if (!validTypes.includes(file.type)) {
    throw new Error("Invalid file type. Please upload a JPEG, PNG, WebP, or GIF image.");
  }

  // Validate file size (max 5MB)
  const maxSize = 5 * 1024 * 1024; // 5MB
  if (file.size > maxSize) {
    throw new Error("File size must be less than 5MB");
  }

  try {
    // Use simpler path structure: {walletAddress}/profile.{ext}
    const ext = file.type.split("/")[1]; // Get extension from mime type
    const filePath = `${walletAddress}/profile.${ext}`;

    // Upload to Supabase storage
    const { data, error } = await supabase.storage
      .from("profile-pictures")
      .upload(filePath, file, {
        cacheControl: "3600",
        upsert: true, // Overwrite existing profile picture
      });

    if (error) {
      console.error("Upload error:", error);
      
      // Check if error is RLS-related
      if (error.message.includes("row-level security") || error.message.includes("RLS")) {
        throw new Error(
          "Storage bucket RLS is enabled. Please disable RLS on the profile-pictures bucket in Supabase, or contact your administrator."
        );
      }
      
      throw new Error(`Upload failed: ${error.message}`);
    }

    // Get the public URL
    const {
      data: { publicUrl },
    } = supabase.storage
      .from("profile-pictures")
      .getPublicUrl(data.path);

    console.log("Profile picture uploaded successfully:", publicUrl);
    return publicUrl;
  } catch (error) {
    console.error("Error uploading profile picture:", error);
    throw error;
  }
};

/**
 * Delete a profile picture from Supabase storage
 * @param filePath - The path of the file to delete
 */
export const deleteProfilePicture = async (filePath: string): Promise<void> => {
  try {
    const { error } = await supabase.storage
      .from("profile-pictures")
      .remove([filePath]);

    if (error) {
      console.error("Delete error:", error);
      throw new Error(`Delete failed: ${error.message}`);
    }
  } catch (error) {
    console.error("Error deleting profile picture:", error);
    throw error;
  }
};

/**
 * Save profile data to local storage or database
 * @param walletAddress - The user's wallet address
 * @param profilePictureUrl - The URL of the profile picture
 */
export const saveProfileData = (walletAddress: string, profilePictureUrl: string): void => {
  try {
    const profileData = {
      walletAddress,
      profilePictureUrl,
      updatedAt: new Date().toISOString(),
    };

    // Save to localStorage for persistence
    localStorage.setItem(
      `tower-finance-profile-${walletAddress}`,
      JSON.stringify(profileData)
    );
  } catch (error) {
    console.error("Error saving profile data:", error);
  }
};

/**
 * Load profile data from local storage or fetch from Supabase
 * @param walletAddress - The user's wallet address
 */
export const loadProfileData = async (walletAddress: string): Promise<string | null> => {
  try {
    // First try to load from localStorage
    const data = localStorage.getItem(`tower-finance-profile-${walletAddress}`);
    if (data) {
      const profileData = JSON.parse(data);
      if (profileData.profilePictureUrl) {
        return profileData.profilePictureUrl;
      }
    }

    // Try to load from a standard path in storage
    // Use a simple naming convention: profile/{walletAddress}.jpg
    const standardPaths = ["profile.jpg", "profile.png", "profile.webp"];
    
    for (const fileName of standardPaths) {
      const {
        data: { publicUrl },
      } = supabase.storage
        .from("profile-pictures")
        .getPublicUrl(`${walletAddress}/${fileName}`);
      
      // Check if file exists by fetching it with a HEAD request
      try {
        const response = await fetch(publicUrl, { method: "HEAD" });
        if (response.ok) {
          // Cache it in localStorage
          saveProfileData(walletAddress, publicUrl);
          return publicUrl;
        }
      } catch {
        // File doesn't exist, try next path
        continue;
      }
    }

    return null;
  } catch (error) {
    console.error("Error loading profile data:", error);
    return null;
  }
};
