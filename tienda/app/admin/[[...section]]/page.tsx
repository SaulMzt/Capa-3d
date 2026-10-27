import Admin from '@/components/admin/Admin';
export default async function Page({params}:{params:Promise<{section?:string[]}>}){const {section}=await params;return <Admin section={section?.[0]||'dashboard'}/>}
