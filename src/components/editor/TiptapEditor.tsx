import React from 'react';
import { useEditor, EditorContent, Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Underline from '@tiptap/extension-underline';
import TextStyle from '@tiptap/extension-text-style';
import Color from '@tiptap/extension-color';
import TextAlign from '@tiptap/extension-text-align';
import Placeholder from '@tiptap/extension-placeholder';
import { Button } from '@/components/ui/button';
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  List,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Image as ImageIcon,
  Trash2,
  Palette,
  ChevronDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import './TiptapEditor.css';

export interface TiptapEditorRef {
  getEditor: () => Editor | null;
  getHTML: () => string;
  clearContent: () => void;
}

interface TiptapEditorProps {
  content: string;
  onChange: (html: string) => void;
  onImageUpload?: () => Promise<string>;
  placeholder?: string;
  className?: string;
  editorClassName?: string;
  autofocus?: boolean;
}

// Define common colors for the color picker
const COLORS = [
  { name: 'Default', value: 'inherit' },
  { name: 'Black', value: '#000000' },
  { name: 'Gray', value: '#6b7280' },
  { name: 'Red', value: '#ef4444' },
  { name: 'Orange', value: '#f97316' },
  { name: 'Yellow', value: '#eab308' },
  { name: 'Green', value: '#22c55e' },
  { name: 'Blue', value: '#3b82f6' },
  { name: 'Purple', value: '#a855f7' },
  { name: 'Pink', value: '#ec4899' },
];

const TiptapEditor = React.forwardRef<TiptapEditorRef, TiptapEditorProps>(
  ({ content, onChange, onImageUpload, placeholder = 'Start typing...', className, editorClassName, autofocus = false }, ref) => {
    const [editorError, setEditorError] = React.useState<string | null>(null);
    const [isEditorReady, setIsEditorReady] = React.useState(false);
    const [showColorPicker, setShowColorPicker] = React.useState(false);
    const colorPickerRef = React.useRef<HTMLDivElement>(null);
    const contentRef = React.useRef(content);
    const editorRef = React.useRef<Editor | null>(null);
    
    // Update content ref when prop changes
    React.useEffect(() => {
      contentRef.current = content;
    }, [content]);
    
    // Close color picker when clicking outside
    React.useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        if (colorPickerRef.current && !colorPickerRef.current.contains(event.target as Node)) {
          setShowColorPicker(false);
        }
      };
      
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }, []);
    
    // Expose editor methods via ref
    React.useEffect(() => {
      if (ref) {
        const refValue = {
          getEditor: () => editorRef.current,
          getHTML: () => {
            try {
              return editorRef.current?.getHTML() || '';
            } catch (error) {
              console.error('Error getting HTML:', error);
              return '';
            }
          },
          clearContent: () => {
            try {
              if (editorRef.current) {
                editorRef.current.commands.clearContent();
              }
            } catch (error) {
              console.error('Error clearing content:', error);
            }
          },
        };
        
        // @ts-ignore - TypeScript doesn't understand this pattern well
        if (typeof ref === 'function') {
          ref(refValue);
        } else {
          ref.current = refValue;
        }
      }
    }, [ref]);
    
    try {
      const editor = useEditor({
        extensions: [
          StarterKit,
          Image,
          Underline,
          TextStyle,
          Color,
          TextAlign.configure({
            types: ['heading', 'paragraph'],
          }),
          Placeholder.configure({
            placeholder,
            emptyEditorClass: 'is-editor-empty',
          }),
        ],
        content: contentRef.current,
        onUpdate: ({ editor }) => {
          try {
            const html = editor.getHTML();
            onChange(html);
          } catch (error) {
            console.error('Error in editor update:', error);
            setEditorError('Error updating content');
          }
        },
        editorProps: {
          attributes: {
            class: cn('prose dark:prose-invert focus:outline-none max-w-none', editorClassName),
          },
        },
        autofocus: false, // We'll handle focus manually
        onCreate: ({ editor }) => {
          editorRef.current = editor;
          setIsEditorReady(true);
        },
        onDestroy: () => {
          editorRef.current = null;
        },
      });

      // Update content when it changes externally and editor is ready
      React.useEffect(() => {
        if (editor && isEditorReady && content !== editor.getHTML()) {
          try {
            // Use a timeout to ensure the editor is fully initialized
            const timer = setTimeout(() => {
              editor.commands.setContent(content);
            }, 50);
            
            return () => clearTimeout(timer);
          } catch (error) {
            console.error('Error setting content:', error);
            setEditorError('Error setting content');
          }
        }
      }, [editor, content, isEditorReady]);

      // Focus editor when autofocus is true and editor is ready
      React.useEffect(() => {
        if (autofocus && editor && isEditorReady) {
          const timer = setTimeout(() => {
            try {
              editor.commands.focus();
            } catch (error) {
              console.error('Error focusing editor:', error);
            }
          }, 200);
          
          return () => clearTimeout(timer);
        }
      }, [autofocus, editor, isEditorReady]);

      const addImage = async () => {
        if (!editor || !onImageUpload) return;
        
        try {
          const url = await onImageUpload();
          if (url) {
            editor.chain().focus().setImage({ src: url }).run();
          }
        } catch (error) {
          console.error('Failed to upload image:', error);
        }
      };

      if (editorError) {
        return (
          <div className="p-4 border border-red-500 rounded-md bg-red-50 text-red-700">
            <p>Editor Error: {editorError}</p>
            <Button 
              variant="outline" 
              className="mt-2" 
              onClick={() => {
                setEditorError(null);
                window.location.reload(); // Force reload on error
              }}
            >
              Reload Editor
            </Button>
          </div>
        );
      }

      return (
        <div className={cn('tiptap-editor-container', className)}>
          <div className="tiptap-toolbar">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => editor?.chain().focus().toggleBold().run()}
              className={editor?.isActive('bold') ? 'active' : ''}
            >
              <Bold className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => editor?.chain().focus().toggleItalic().run()}
              className={editor?.isActive('italic') ? 'active' : ''}
            >
              <Italic className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => editor?.chain().focus().toggleUnderline().run()}
              className={editor?.isActive('underline') ? 'active' : ''}
            >
              <UnderlineIcon className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => editor?.chain().focus().toggleBulletList().run()}
              className={editor?.isActive('bulletList') ? 'active' : ''}
            >
              <List className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => editor?.chain().focus().setTextAlign('left').run()}
              className={editor?.isActive({ textAlign: 'left' }) ? 'active' : ''}
            >
              <AlignLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => editor?.chain().focus().setTextAlign('center').run()}
              className={editor?.isActive({ textAlign: 'center' }) ? 'active' : ''}
            >
              <AlignCenter className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => editor?.chain().focus().setTextAlign('right').run()}
              className={editor?.isActive({ textAlign: 'right' }) ? 'active' : ''}
            >
              <AlignRight className="h-4 w-4" />
            </Button>
            
            {/* Color Picker */}
            <div className="relative" ref={colorPickerRef}>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowColorPicker(!showColorPicker)}
                className="flex items-center gap-1"
              >
                <Palette className="h-4 w-4" />
                <ChevronDown className="h-3 w-3" />
              </Button>
              
              {showColorPicker && (
                <div className="absolute z-50 mt-1 w-40 rounded-md border border-gray-200 bg-white shadow-lg dark:border-gray-800 dark:bg-gray-900">
                  <div className="p-1 grid grid-cols-2 gap-1">
                    {COLORS.map((color) => (
                      <button
                        key={color.value}
                        className="flex items-center gap-2 px-2 py-1.5 text-sm rounded-sm hover:bg-gray-100 dark:hover:bg-gray-800"
                        onClick={() => {
                          if (editor) {
                            editor.chain().focus().setColor(color.value).run();
                            setShowColorPicker(false);
                          }
                        }}
                      >
                        <div 
                          className="w-4 h-4 rounded-full border border-gray-200" 
                          style={{ backgroundColor: color.value === 'inherit' ? 'transparent' : color.value }}
                        />
                        <span style={{ color: color.value === 'inherit' ? 'inherit' : color.value }}>
                          {color.name}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            
            {onImageUpload && (
              <Button
                variant="ghost"
                size="sm"
                onClick={addImage}
              >
                <ImageIcon className="h-4 w-4" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => editor?.chain().focus().clearContent().run()}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
          
          <EditorContent editor={editor} />
          
          {!isEditorReady && (
            <div className="flex items-center justify-center min-h-[250px] absolute inset-0 bg-background/50">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
            </div>
          )}
        </div>
      );
    } catch (error) {
      console.error('Fatal editor error:', error);
      return (
        <div className="p-4 border border-red-500 rounded-md bg-red-50 text-red-700">
          <p>Failed to initialize editor. Please try refreshing the page.</p>
          <Button 
            variant="outline" 
            className="mt-2" 
            onClick={() => window.location.reload()}
          >
            Refresh Page
          </Button>
        </div>
      );
    }
  }
);

TiptapEditor.displayName = 'TiptapEditor';

export default TiptapEditor; 