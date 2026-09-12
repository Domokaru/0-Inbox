import os
import zipfile

def create_project_zip():
    source_dir = 'android'
    target_zip = 'public/ZeroInbox-Android-Project.zip'
    
    with zipfile.ZipFile(target_zip, 'w', zipfile.ZIP_DEFLATED) as zf:
        for root, dirs, files in os.walk(source_dir):
            # Exclude build directories and local properties
            dirs[:] = [d for d in dirs if d not in ('.gradle', 'build', '.idea')]
            for file in files:
                if file.endswith(('.iml', '.DS_Store', 'local.properties')):
                    continue
                full_path = os.path.join(root, file)
                rel_path = os.path.relpath(full_path, source_dir)
                zf.write(full_path, rel_path)
                
    print(f"Successfully packaged {target_zip}")

if __name__ == '__main__':
    create_project_zip()
