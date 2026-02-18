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
    // Create a unique filename
    const timestamp = Date.now();
    const fileName = `${walletAddress}-${timestamp}-${file.name}`;
    const filePath = `${fileName}`;

    // Upload to Supabase storage
    // Note: Make sure RLS is disabled on the profile-pictures bucket
    // or create appropriate RLS policies for public uploads
    const { data, error } = await supabase.storage
      .from("profile-pictures")
      .upload(filePath, file, {
        cacheControl: "3600",
        upsert: true, // Allow overwriting if file exists
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
 * Load profile data from local storage
 * @param walletAddress - The user's wallet address
 */
export const loadProfileData = (walletAddress: string): string | null => {
  try {
    const data = localStorage.getItem(`tower-finance-profile-${walletAddress}`);
    if (data) {
      const profileData = JSON.parse(data);
      return profileData.profilePictureUrl || null;
    }
    return null;
  } catch (error) {
    console.error("Error loading profile data:", error);
    return null;
  }
};
