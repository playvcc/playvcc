// VCC Remove Old Top PFP Upload Fix
// Add this to edit-profile.html before </body>, AFTER profile-pfp-upload.js:
// <script src="remove-old-pfp-upload.js"></script>
// This hides/removes the broken top-left file chooser + old upload button only.
// It keeps the new bottom "PROFILE PICTURE" uploader.

(function(){
  function removeOldTopUploader(){
    const bottomUploader = document.getElementById('vccPfpUploader');

    // Remove old buttons/inputs near the top avatar, but keep the new bottom uploader.
    document.querySelectorAll('input[type="file"]').forEach(input => {
      if(bottomUploader && bottomUploader.contains(input)) return;

      const parent =
        input.closest('.hero-left') ||
        input.closest('.avatar-upload') ||
        input.closest('.profile-avatar') ||
        input.parentElement;

      if(parent && !parent.contains(bottomUploader)){
        input.style.display = 'none';

        // Hide nearby text/label if it is the old choose-file row.
        const label = input.closest('label');
        if(label) label.style.display = 'none';
      }
    });

    document.querySelectorAll('button, a').forEach(el => {
      if(bottomUploader && bottomUploader.contains(el)) return;

      const text = (el.textContent || '').trim().toLowerCase();

      if(
        text === 'upload profile picture' ||
        text === 'upload pfp' ||
        text === 'upload avatar'
      ){
        const parent =
          el.closest('.hero-left') ||
          el.closest('.avatar-upload') ||
          el.closest('.profile-avatar') ||
          el.parentElement;

        if(parent && !parent.contains(bottomUploader)){
          el.style.display = 'none';
        }
      }
    });

    // If the old status text is sitting under the top avatar, hide only that top old status.
    document.querySelectorAll('.log, .empty-box, div, p').forEach(el => {
      if(bottomUploader && bottomUploader.contains(el)) return;

      const text = (el.textContent || '').trim().toLowerCase();
      if(text === 'profile loaded.' && el.getBoundingClientRect().top < 450){
        el.style.display = 'none';
      }
    });
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', removeOldTopUploader);
  }else{
    removeOldTopUploader();
  }

  // Run a few times because other profile scripts may inject/load after this.
  setTimeout(removeOldTopUploader, 500);
  setTimeout(removeOldTopUploader, 1500);
})();
